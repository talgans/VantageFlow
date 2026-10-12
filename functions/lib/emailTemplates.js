"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTaskFeedbackEmail = exports.getTaskCompletedEmail = exports.getTaskImpedimentResolvedEmail = exports.getTaskImpedimentEmail = exports.getProjectArchivedEmail = exports.getAchievementEmail = exports.getResponsibilityAssignedEmail = exports.getNewMemberEmail = exports.getReminderEmail = exports.getInvitationEmail = exports.footerStyle = exports.buttonStyle = exports.commonStyles = void 0;
exports.commonStyles = `
  font-family: Arial, sans-serif;
  max-width: 600px;
  margin: 0 auto;
  color: #334155;
`;
exports.buttonStyle = `
  background-color: #3b82f6;
  color: white;
  padding: 12px 24px;
  text-decoration: none;
  border-radius: 6px;
  display: inline-block;
  font-weight: bold;
`;
exports.footerStyle = `
  color: #94a3b8;
  font-size: 12px;
  margin-top: 30px;
  border-top: 1px solid #e2e8f0;
  padding-top: 20px;
`;
const getInvitationEmail = (role, setupLink) => `
<div style="${exports.commonStyles}">
  <h2 style="color: #3b82f6;">Welcome to VantageFlow</h2>
  <p>You have been invited to join <strong>VantageFlow</strong> as a <strong>${role}</strong>.</p>
  <p>To get started, please set your password by clicking the button below:</p>
  <div style="margin: 30px 0;">
    <a href="${setupLink}" style="${exports.buttonStyle}">
      Complete Account Setup
    </a>
  </div>
  <p style="color: #64748b; font-size: 14px;">
    This setup link will expire in <strong>48 hours</strong>. If you didn't expect this invitation, you can safely ignore this email.
  </p>
  <div style="${exports.footerStyle}">
    VantageFlow - Project Management & KPI Dashboard
  </div>
</div>
`;
exports.getInvitationEmail = getInvitationEmail;
const getReminderEmail = (role, setupLink) => `
<div style="${exports.commonStyles}">
  <h2 style="color: #3b82f6;">Action Required: Complete Account Setup</h2>
  <p>You were invited to join <strong>VantageFlow</strong> as a <strong>${role}</strong>, but haven't set your password yet.</p>
  <p>To get started, please set your password by clicking the button below:</p>
  <div style="margin: 30px 0;">
    <a href="${setupLink}" style="${exports.buttonStyle}">
      Complete Account Setup
    </a>
  </div>
  <div style="background-color: #fef3c7; border: 1px solid #f59e0b; border-radius: 6px; padding: 12px; margin: 20px 0;">
    <p style="color: #92400e; font-size: 13px; margin: 0;">
      <strong>Important:</strong> If you received multiple emails, please use the link from this most recent email. Previous links have been deactivated.
    </p>
  </div>
  <p style="color: #64748b; font-size: 14px;">
    This setup link will expire in <strong>48 hours</strong>. If you didn't expect this email, you can safely ignore it.
  </p>
  <div style="${exports.footerStyle}">
    VantageFlow - Project Management & KPI Dashboard
  </div>
</div>
`;
exports.getReminderEmail = getReminderEmail;
const getNewMemberEmail = (newMemberName, projectName, inviterName, link) => `
<div style="${exports.commonStyles}">
  <h2 style="color: #3b82f6;">New Project Member</h2>
  <p><strong>${newMemberName}</strong> has been added to project <strong>${projectName}</strong> by ${inviterName}.</p>
  <div style="margin: 20px 0;">
    <a href="${link}" style="${exports.buttonStyle}">
      View Project
    </a>
  </div>
  <div style="${exports.footerStyle}">
    VantageFlow Team
  </div>
</div>
`;
exports.getNewMemberEmail = getNewMemberEmail;
const getResponsibilityAssignedEmail = (itemType, itemName, projectName, assignerName, link) => `
<div style="${exports.commonStyles}">
  <h2 style="color: #3b82f6;">New Assignment</h2>
  <p>You have been assigned to <strong>${itemType}: ${itemName}</strong> in project <strong>${projectName}</strong> by ${assignerName}.</p>
  <div style="margin: 20px 0;">
    <a href="${link}" style="${exports.buttonStyle}">
      View Assignment
    </a>
  </div>
  <div style="${exports.footerStyle}">
    VantageFlow Team
  </div>
</div>
`;
exports.getResponsibilityAssignedEmail = getResponsibilityAssignedEmail;
const getAchievementEmail = (userName, points, description) => `
<div style="${exports.commonStyles}">
   <h2 style="color: #3b82f6;">Achievement Unlocked!</h2>
   <p>Hi ${userName},</p>
   <p>You've just earned <strong>${points} points</strong> for:</p>
   <p style="font-size: 18px; font-weight: bold; color: #1e293b; background-color: #f1f5f9; padding: 15px; border-radius: 8px; border-left: 4px solid #3b82f6;">
     ${description}
   </p>
   <p>Keep up the great work!</p>
   <div style="${exports.footerStyle}">
     VantageFlow Team
   </div>
</div>
`;
exports.getAchievementEmail = getAchievementEmail;
const getProjectArchivedEmail = (projectName, actionBy, isArchived, link) => `
<div style="${exports.commonStyles}">
   <h2 style="color: ${isArchived ? '#f59e0b' : '#22c55e'};">Project ${isArchived ? 'Archived' : 'Unarchived'}</h2>
   <p>The project <strong>${projectName}</strong> has been ${isArchived ? 'archived' : 'unarchived'} by ${actionBy}.</p>
   ${isArchived
    ? `<p style="color: #64748b;">No further edits can be made to this project until it is unarchived.</p>`
    : `<p style="color: #64748b;">The project is now active and can be edited again.</p>`}
   <div style="margin: 20px 0;">
     <a href="${link}" style="${exports.buttonStyle}">
       View Project
     </a>
   </div>
   <div style="${exports.footerStyle}">
     VantageFlow Team
   </div>
</div>
`;
exports.getProjectArchivedEmail = getProjectArchivedEmail;
const getTaskImpedimentEmail = (taskName, projectName, reportedByName, category, description, link) => `
<div style="${exports.commonStyles}">
  <div style="background-color: #fef2f2; border: 1px solid #ef4444; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
    <h2 style="color: #dc2626; margin-top: 0;">⚠️ Task Impediment Flagged</h2>
    <p style="margin: 0; color: #991b1b; font-weight: bold;">
      Action required: An impediment has been reported on a task.
    </p>
  </div>
  <p><strong>${reportedByName}</strong> has flagged a blocker on <strong>${taskName}</strong> in project <strong>${projectName}</strong>.</p>
  <div style="background-color: #f8fafc; border-left: 4px solid #ef4444; padding: 12px 16px; margin: 16px 0; border-radius: 4px;">
    <p style="margin: 0 0 6px 0; font-size: 13px; color: #64748b; text-transform: uppercase; font-weight: bold;">
      Category: <span style="color: #dc2626;">${category}</span>
    </p>
    <p style="margin: 0; color: #1e293b; font-size: 15px; line-height: 1.5;">
      "${description}"
    </p>
  </div>
  <div style="margin: 25px 0;">
    <a href="${link}" style="${exports.buttonStyle}">
      Review & Unblock Task
    </a>
  </div>
  <div style="${exports.footerStyle}">
    VantageFlow - Feedback & Task Management
  </div>
</div>
`;
exports.getTaskImpedimentEmail = getTaskImpedimentEmail;
const getTaskImpedimentResolvedEmail = (taskName, projectName, resolvedByName, resolutionNote, link) => `
<div style="${exports.commonStyles}">
  <div style="background-color: #f0fdf4; border: 1px solid #22c55e; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
    <h2 style="color: #16a34a; margin-top: 0;">✅ Impediment Resolved</h2>
    <p style="margin: 0; color: #15803d; font-weight: bold;">
      The blocker on task has been cleared.
    </p>
  </div>
  <p><strong>${resolvedByName}</strong> has marked the impediment resolved on <strong>${taskName}</strong> in project <strong>${projectName}</strong>.</p>
  ${resolutionNote ? `
  <div style="background-color: #f8fafc; border-left: 4px solid #22c55e; padding: 12px 16px; margin: 16px 0; border-radius: 4px;">
    <p style="margin: 0; color: #1e293b; font-size: 14px;">"${resolutionNote}"</p>
  </div>` : ''}
  <div style="margin: 25px 0;">
    <a href="${link}" style="${exports.buttonStyle}">
      View Task Progress
    </a>
  </div>
  <div style="${exports.footerStyle}">
    VantageFlow - Feedback & Task Management
  </div>
</div>
`;
exports.getTaskImpedimentResolvedEmail = getTaskImpedimentResolvedEmail;
const getTaskCompletedEmail = (taskName, projectName, completedByName, deliverablesSummary, link) => `
<div style="${exports.commonStyles}">
  <div style="background-color: #f0fdf4; border: 1px solid #22c55e; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
    <h2 style="color: #16a34a; margin-top: 0;">🎉 Task Marked 100% Complete</h2>
    <p style="margin: 0; color: #15803d; font-weight: bold;">
      Feedback & Completion Report
    </p>
  </div>
  <p><strong>${completedByName}</strong> has finished working on <strong>${taskName}</strong> in project <strong>${projectName}</strong>.</p>
  ${deliverablesSummary ? `
  <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 14px; margin: 16px 0;">
    <p style="margin: 0 0 6px 0; font-size: 13px; color: #64748b; font-weight: bold;">Deliverables / Scope:</p>
    <p style="margin: 0; color: #334155; font-size: 14px;">${deliverablesSummary}</p>
  </div>` : ''}
  <div style="margin: 25px 0;">
    <a href="${link}" style="${exports.buttonStyle}">
      Review Completed Task
    </a>
  </div>
  <div style="${exports.footerStyle}">
    VantageFlow - Feedback & Task Management
  </div>
</div>
`;
exports.getTaskCompletedEmail = getTaskCompletedEmail;
const getTaskFeedbackEmail = (taskName, projectName, authorName, message, link) => `
<div style="${exports.commonStyles}">
  <h2 style="color: #3b82f6;">💬 New Task Note / Feedback</h2>
  <p><strong>${authorName}</strong> posted an update on <strong>${taskName}</strong> in project <strong>${projectName}</strong>:</p>
  <div style="background-color: #f8fafc; border-left: 4px solid #3b82f6; padding: 12px 16px; margin: 16px 0; border-radius: 4px;">
    <p style="margin: 0; color: #1e293b; font-size: 14px; line-height: 1.5;">"${message}"</p>
  </div>
  <div style="margin: 25px 0;">
    <a href="${link}" style="${exports.buttonStyle}">
      View Task & Reply
    </a>
  </div>
  <div style="${exports.footerStyle}">
    VantageFlow - Feedback & Task Management
  </div>
</div>
`;
exports.getTaskFeedbackEmail = getTaskFeedbackEmail;
//# sourceMappingURL=emailTemplates.js.map