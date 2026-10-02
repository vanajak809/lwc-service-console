/**
 * Read-only Apex controller for the service console LWCs.
 *
 * - Every method is cacheable (Lightning Data Service client cache).
 * - Every query runs WITH USER_MODE, so CRUD, FLS and sharing are enforced.
 * - Errors are converted to AuraHandledException with a safe, generic message;
 *   internal details are never sent to the browser.
 */
public with sharing class ServiceConsoleController {
    @TestVisible
    private static final Integer MIN_SEARCH_LENGTH = 2;
    @TestVisible
    private static final Integer DEFAULT_LIMIT = 25;
    @TestVisible
    private static final Integer MAX_LIMIT = 50;
    private static final Integer TIMELINE_LIMIT = 100;

    @AuraEnabled(cacheable=true)
    public static List<CaseSummary> searchCases(String searchTerm, Integer limitSize) {
        String term = searchTerm == null ? '' : searchTerm.trim();
        if (term.length() < MIN_SEARCH_LENGTH) {
            return new List<CaseSummary>();
        }
        String likePattern = '%' + escapeLike(term) + '%';
        Integer rowLimit = clampLimit(limitSize);
        try {
            List<CaseSummary> results = new List<CaseSummary>();
            for (Case record : [
                SELECT Id, CaseNumber, Subject, Status, Priority, CreatedDate, AccountId, Account.Name
                FROM Case
                WHERE CaseNumber LIKE :likePattern OR Subject LIKE :likePattern OR Account.Name LIKE :likePattern
                WITH USER_MODE
                ORDER BY CreatedDate DESC
                LIMIT :rowLimit
            ]) {
                results.add(new CaseSummary(record));
            }
            return results;
        } catch (QueryException e) {
            throw auraError('Unable to search cases. Check that you have access to cases and accounts.');
        }
    }

    @AuraEnabled(cacheable=true)
    public static CustomerSummary getCustomerSummary(Id accountId) {
        if (accountId == null) {
            throw auraError('An account Id is required.');
        }
        try {
            List<Account> accounts = [
                SELECT Id, Name, Member_Tier__c, Member_Since__c
                FROM Account
                WHERE Id = :accountId
                WITH USER_MODE
                LIMIT 1
            ];
            if (accounts.isEmpty()) {
                throw auraError('The customer record was not found or you do not have access to it.');
            }
            CustomerSummary summary = new CustomerSummary(accounts[0]);
            summary.openCases = [
                SELECT COUNT()
                FROM Case
                WHERE AccountId = :accountId AND IsClosed = FALSE
                WITH USER_MODE
            ];
            summary.highPriorityOpenCases = [
                SELECT COUNT()
                FROM Case
                WHERE AccountId = :accountId AND IsClosed = FALSE AND Priority = 'High'
                WITH USER_MODE
            ];
            summary.closedLast90Days = [
                SELECT COUNT()
                FROM Case
                WHERE AccountId = :accountId AND IsClosed = TRUE AND ClosedDate = LAST_N_DAYS:90
                WITH USER_MODE
            ];
            return summary;
        } catch (QueryException e) {
            throw auraError('Unable to load the customer summary. Check your field access.');
        }
    }

    @AuraEnabled(cacheable=true)
    public static List<TimelineEntry> getCaseTimeline(Id caseId) {
        if (caseId == null) {
            throw auraError('A case Id is required.');
        }
        try {
            List<Case> cases = [
                SELECT Id, CaseNumber, Subject, CreatedDate, CreatedBy.Name
                FROM Case
                WHERE Id = :caseId
                WITH USER_MODE
                LIMIT 1
            ];
            if (cases.isEmpty()) {
                throw auraError('The case was not found or you do not have access to it.');
            }
            Case record = cases[0];
            List<TimelineEntry> entries = new List<TimelineEntry>();
            entries.add(
                new TimelineEntry(
                    record.Id,
                    'created',
                    'Case ' + record.CaseNumber + ' created',
                    record.Subject,
                    record.CreatedDate,
                    record.CreatedBy?.Name
                )
            );
            for (CaseComment comment : [
                SELECT Id, CommentBody, IsPublished, CreatedDate, CreatedBy.Name
                FROM CaseComment
                WHERE ParentId = :caseId
                WITH USER_MODE
                ORDER BY CreatedDate DESC
                LIMIT :TIMELINE_LIMIT
            ]) {
                entries.add(
                    new TimelineEntry(
                        comment.Id,
                        'comment',
                        comment.IsPublished ? 'Public comment' : 'Internal comment',
                        comment.CommentBody,
                        comment.CreatedDate,
                        comment.CreatedBy?.Name
                    )
                );
            }
            for (CaseHistory history : [
                SELECT Id, Field, OldValue, NewValue, CreatedDate, CreatedBy.Name
                FROM CaseHistory
                WHERE CaseId = :caseId AND Field != 'created'
                WITH USER_MODE
                ORDER BY CreatedDate DESC
                LIMIT :TIMELINE_LIMIT
            ]) {
                entries.add(
                    toFieldChangeEntry(
                        history.Id,
                        history.Field,
                        history.OldValue,
                        history.NewValue,
                        history.CreatedDate,
                        history.CreatedBy?.Name
                    )
                );
            }
            entries.sort();
            return entries;
        } catch (QueryException e) {
            throw auraError('Unable to load the case timeline. Check your access to case comments and history.');
        }
    }

    @TestVisible
    private static TimelineEntry toFieldChangeEntry(
        Id entryId,
        String fieldName,
        Object oldValue,
        Object newValue,
        Datetime occurredAt,
        String actor
    ) {
        String fromText = oldValue == null ? '(blank)' : String.valueOf(oldValue);
        String toText = newValue == null ? '(blank)' : String.valueOf(newValue);
        return new TimelineEntry(
            entryId,
            'fieldChange',
            fieldName + ' changed',
            fromText + ' -> ' + toText,
            occurredAt,
            actor
        );
    }

    @TestVisible
    private static String escapeLike(String value) {
        return value.replace('\\', '\\\\').replace('%', '\\%').replace('_', '\\_');
    }

    @TestVisible
    private static Integer clampLimit(Integer requested) {
        if (requested == null || requested < 1) {
            return DEFAULT_LIMIT;
        }
        return Math.min(requested, MAX_LIMIT);
    }

    private static AuraHandledException auraError(String message) {
        AuraHandledException error = new AuraHandledException(message);
        error.setMessage(message);
        return error;
    }

    // ------------------------------------------------------------------ DTOs

    public class CaseSummary {
        @AuraEnabled
        public Id id;
        @AuraEnabled
        public String caseNumber;
        @AuraEnabled
        public String subject;
        @AuraEnabled
        public String status;
        @AuraEnabled
        public String priority;
        @AuraEnabled
        public Datetime createdDate;
        @AuraEnabled
        public Id accountId;
        @AuraEnabled
        public String accountName;

        public CaseSummary(Case record) {
            this.id = record.Id;
            this.caseNumber = record.CaseNumber;
            this.subject = record.Subject;
            this.status = record.Status;
            this.priority = record.Priority;
            this.createdDate = record.CreatedDate;
            this.accountId = record.AccountId;
            this.accountName = record.Account?.Name;
        }
    }

    public class CustomerSummary {
        @AuraEnabled
        public Id accountId;
        @AuraEnabled
        public String name;
        @AuraEnabled
        public String memberTier;
        @AuraEnabled
        public Date memberSince;
        @AuraEnabled
        public Integer openCases = 0;
        @AuraEnabled
        public Integer highPriorityOpenCases = 0;
        @AuraEnabled
        public Integer closedLast90Days = 0;

        public CustomerSummary(Account record) {
            this.accountId = record.Id;
            this.name = record.Name;
            this.memberTier = record.Member_Tier__c;
            this.memberSince = record.Member_Since__c;
        }
    }

    public class TimelineEntry implements Comparable {
        @AuraEnabled
        public Id id;
        @AuraEnabled
        public String entryType;
        @AuraEnabled
        public String title;
        @AuraEnabled
        public String body;
        @AuraEnabled
        public Datetime occurredAt;
        @AuraEnabled
        public String actor;

        public TimelineEntry(Id id, String entryType, String title, String body, Datetime occurredAt, String actor) {
            this.id = id;
            this.entryType = entryType;
            this.title = title;
            this.body = body;
            this.occurredAt = occurredAt;
            this.actor = actor;
        }

        /** Newest first; entries without a timestamp go last. */
        public Integer compareTo(Object other) {
            Datetime theirs = ((TimelineEntry) other).occurredAt;
            if (occurredAt == theirs) {
                return 0;
            }
            if (occurredAt == null) {
                return 1;
            }
            if (theirs == null) {
                return -1;
            }
            return occurredAt > theirs ? -1 : 1;
        }
    }
}
