@IsTest
private class ServiceConsoleController_Test {
    private static User createConsoleUser() {
        Profile standardProfile = [SELECT Id FROM Profile WHERE Name = 'Standard User' LIMIT 1];
        String unique = String.valueOf(Math.abs(Crypto.getRandomInteger())) + '.' + UserInfo.getOrganizationId();
        User consoleUser = new User(
            Alias = 'console',
            Email = 'console.' + unique + '@example.com',
            EmailEncodingKey = 'UTF-8',
            FirstName = 'Test',
            LastName = 'Console',
            LanguageLocaleKey = 'en_US',
            LocaleSidKey = 'en_US',
            ProfileId = standardProfile.Id,
            TimeZoneSidKey = 'America/New_York',
            Username = 'console.' + unique + '@example.com'
        );
        System.runAs(new User(Id = UserInfo.getUserId())) {
            insert consoleUser;
            PermissionSet permissionSet = [SELECT Id FROM PermissionSet WHERE Name = 'Service_Console_User' LIMIT 1];
            insert new PermissionSetAssignment(AssigneeId = consoleUser.Id, PermissionSetId = permissionSet.Id);
        }
        return consoleUser;
    }

    private static Account createCustomerWithCases() {
        Account account = new Account(
            Name = 'Synthetic Harbor Member',
            Member_Tier__c = 'Premier',
            Member_Since__c = Date.newInstance(2019, 4, 1)
        );
        insert account;
        insert new List<Case>{
            new Case(AccountId = account.Id, Subject = 'Synthetic card replacement', Priority = 'High', Status = 'New'),
            new Case(AccountId = account.Id, Subject = 'Synthetic address update', Priority = 'Low', Status = 'New'),
            new Case(
                AccountId = account.Id,
                Subject = 'Synthetic statement copy',
                Priority = 'Medium',
                Status = 'Closed'
            )
        };
        return account;
    }

    @IsTest
    static void searchMatchesSubjectAndAccountName() {
        System.runAs(createConsoleUser()) {
            createCustomerWithCases();
            Test.startTest();
            List<ServiceConsoleController.CaseSummary> bySubject = ServiceConsoleController.searchCases(
                'card repl',
                10
            );
            List<ServiceConsoleController.CaseSummary> byAccount = ServiceConsoleController.searchCases('Harbor', null);
            Test.stopTest();

            Assert.areEqual(1, bySubject.size(), 'Subject match');
            Assert.areEqual('Synthetic Harbor Member', bySubject[0].accountName, 'Account name projected');
            Assert.areEqual(3, byAccount.size(), 'Account name match returns all cases');
        }
    }

    @IsTest
    static void shortSearchTermReturnsEmptyWithoutQuery() {
        Assert.isTrue(ServiceConsoleController.searchCases('a', 10).isEmpty(), 'Below min length');
        Assert.isTrue(ServiceConsoleController.searchCases(null, 10).isEmpty(), 'Null term');
        Assert.areEqual(0, Limits.getQueries(), 'No SOQL for short terms');
    }

    @IsTest
    static void likeWildcardsAreEscaped() {
        Assert.areEqual('100\\%\\_off', ServiceConsoleController.escapeLike('100%_off'), 'Wildcards escaped');
        System.runAs(createConsoleUser()) {
            createCustomerWithCases();
            Assert.isTrue(
                ServiceConsoleController.searchCases('%%', 10).isEmpty(),
                'Literal % does not match everything'
            );
        }
    }

    @IsTest
    static void limitIsClamped() {
        Assert.areEqual(
            ServiceConsoleController.DEFAULT_LIMIT,
            ServiceConsoleController.clampLimit(null),
            'Null uses default'
        );
        Assert.areEqual(
            ServiceConsoleController.DEFAULT_LIMIT,
            ServiceConsoleController.clampLimit(0),
            'Zero uses default'
        );
        Assert.areEqual(ServiceConsoleController.MAX_LIMIT, ServiceConsoleController.clampLimit(5000), 'Capped at max');
        Assert.areEqual(7, ServiceConsoleController.clampLimit(7), 'In-range value kept');
    }

    @IsTest
    static void customerSummaryCountsCases() {
        System.runAs(createConsoleUser()) {
            Account account = createCustomerWithCases();
            ServiceConsoleController.CustomerSummary summary = ServiceConsoleController.getCustomerSummary(account.Id);
            Assert.areEqual('Premier', summary.memberTier, 'Tier');
            Assert.areEqual(Date.newInstance(2019, 4, 1), summary.memberSince, 'Member since');
            Assert.areEqual(2, summary.openCases, 'Open cases');
            Assert.areEqual(1, summary.highPriorityOpenCases, 'High priority open');
            Assert.areEqual(1, summary.closedLast90Days, 'Closed recently');
        }
    }

    @IsTest
    static void customerSummaryRequiresId() {
        try {
            ServiceConsoleController.getCustomerSummary(null);
            Assert.fail('Expected AuraHandledException');
        } catch (AuraHandledException e) {
            Assert.areEqual('An account Id is required.', e.getMessage(), 'Validation message');
        }
    }

    @IsTest
    static void customerSummaryForMissingRecord() {
        Account account = new Account(Name = 'Synthetic Deleted Member');
        insert account;
        Id deletedId = account.Id;
        delete account;
        System.runAs(createConsoleUser()) {
            try {
                ServiceConsoleController.getCustomerSummary(deletedId);
                Assert.fail('Expected AuraHandledException');
            } catch (AuraHandledException e) {
                Assert.isTrue(e.getMessage().contains('not found'), e.getMessage());
            }
        }
    }

    @IsTest
    static void timelineIncludesCreationAndComments() {
        System.runAs(createConsoleUser()) {
            Case record = new Case(Subject = 'Synthetic timeline case', Status = 'New');
            insert record;
            insert new List<CaseComment>{
                new CaseComment(ParentId = record.Id, CommentBody = 'Synthetic internal note', IsPublished = false),
                new CaseComment(ParentId = record.Id, CommentBody = 'Synthetic public reply', IsPublished = true)
            };

            List<ServiceConsoleController.TimelineEntry> entries = ServiceConsoleController.getCaseTimeline(record.Id);

            Assert.areEqual(3, entries.size(), 'Creation + 2 comments');
            Set<String> types = new Set<String>();
            for (ServiceConsoleController.TimelineEntry entry : entries) {
                types.add(entry.entryType);
            }
            Assert.isTrue(types.containsAll(new Set<String>{ 'created', 'comment' }), 'Entry types present');
        }
    }

    @IsTest
    static void timelineRequiresId() {
        try {
            ServiceConsoleController.getCaseTimeline(null);
            Assert.fail('Expected AuraHandledException');
        } catch (AuraHandledException e) {
            Assert.areEqual('A case Id is required.', e.getMessage(), 'Validation message');
        }
    }

    @IsTest
    static void fieldChangeEntryFormatsValues() {
        ServiceConsoleController.TimelineEntry entry = ServiceConsoleController.toFieldChangeEntry(
            null,
            'Status',
            'New',
            null,
            Datetime.now(),
            'Test Agent'
        );
        Assert.areEqual('Status changed', entry.title, 'Title');
        Assert.areEqual('New -> (blank)', entry.body, 'Body');
    }

    @IsTest
    static void timelineSortsNewestFirstWithNullsLast() {
        Datetime now = Datetime.now();
        List<ServiceConsoleController.TimelineEntry> entries = new List<ServiceConsoleController.TimelineEntry>{
            new ServiceConsoleController.TimelineEntry(null, 'comment', 'old', null, now.addDays(-2), null),
            new ServiceConsoleController.TimelineEntry(null, 'comment', 'none', null, null, null),
            new ServiceConsoleController.TimelineEntry(null, 'comment', 'new', null, now, null),
            new ServiceConsoleController.TimelineEntry(null, 'comment', 'same', null, now, null)
        };
        entries.sort();
        Assert.isTrue(entries[0].title == 'new' || entries[0].title == 'same', 'Newest first');
        Assert.areEqual('old', entries[2].title, 'Older after newer');
        Assert.areEqual('none', entries[3].title, 'Null timestamps last');
    }
}
