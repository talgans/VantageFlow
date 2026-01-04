# Firebase/Firestore Security Rules Debugging Guide

## Executive Principle

**Security rules issues are the most common cause of Firebase operation failures.** Always verify permissions before investigating application logic.

## When to Suspect Rules Issues

Firestore Security Rules should be your first checkpoint when:

- Implementing cross-functional workflows where different user types interact with shared data
- Adding new features that write to existing collections
- Experiencing synchronization failures between related operations
- Encountering silent failures where operations appear to succeed locally but don't persist

## Diagnostic Indicators

### Clear Signals
- Console error: `FirebaseError: Missing or insufficient permissions`
- Operations fail with permission-related error codes
- Authenticated users receive access denied messages

### Subtle Signals
- Write operations appear successful but data doesn't persist
- State updates in UI but database remains unchanged
- Inconsistent behavior across different user roles
- Features work in development but fail in production

## Systematic Debugging Approach

### 1. Identify the Failure Point
- Check browser console for Firebase errors
- Note the specific collection and operation (read/write/update/delete)
- Document the user role attempting the operation

### 2. Locate Relevant Rules
- Open `firestore.rules` in project root
- Find the collection rule matching your operation
- Identify the permission check being applied

### 3. Verify Role Permissions
- Confirm the user's authentication claims include their role
- Check if the role is explicitly allowed in the security rule
- Verify any conditional logic (ownership checks, status requirements)

### 4. Test Rule Logic
Use Firebase Emulator Suite for isolated testing:
```bash
firebase emulators:start
```

### 5. Deploy Rule Changes
After updating rules:
```bash
firebase deploy --only firestore:rules
```

## Common Permission Patterns

### Role-Based Access
```javascript
allow write: if request.auth != null && 
  request.auth.token.role in ['admin', 'manager', 'staff'];
```

### Owner-Based Access
```javascript
allow write: if request.auth != null && 
  resource.data.userId == request.auth.uid;
```

### Hybrid Access
```javascript
allow write: if request.auth != null && (
  request.auth.token.role == 'admin' ||
  resource.data.userId == request.auth.uid
);
```

## Prevention Strategy

### During Development
- Document required permissions for each new feature
- Update security rules alongside feature implementation
- Test with multiple user roles before deployment
- Include permission checks in code review process

### For Project Planning
- Map user roles to data access requirements early
- Design security rules as part of system architecture
- Plan for role hierarchies and cross-functional workflows
- Consider audit trails for sensitive operations

### For Team Communication
- Maintain a permissions matrix documenting all collections and roles
- Include security rule updates in deployment checklists
- Document permission requirements in feature specifications
- Establish clear ownership of security rules maintenance

## Troubleshooting Checklist

- [ ] Is the user authenticated?
- [ ] Does the user's token contain the expected role claim?
- [ ] Is the role included in the collection's security rule?
- [ ] Are there additional conditions (ownership, status) that must be met?
- [ ] Have rules been deployed to the active Firebase environment?
- [ ] Does the operation type (read/write/update/delete) match the rule?
- [ ] Are there any rule evaluation timeouts or complexity issues?

## Production Monitoring

Implement monitoring for permission-related issues:
- Track `permission-denied` errors in application logs
- Monitor Firebase console for rules evaluation metrics
- Set up alerts for unusual permission denial patterns
- Review security rules during incident post-mortems

## Resources

- Firebase Security Rules documentation: https://firebase.google.com/docs/rules
- Rules simulator in Firebase Console
- Firebase Emulator Suite for local testing
- Rules playground for rapid prototyping