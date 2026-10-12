export const commonStyles = `
  font-family: Arial, sans-serif;
  max-width: 600px;
  margin: 0 auto;
  color: #334155;
`;

export const buttonStyle = `
  background-color: #3b82f6;
  color: white;
  padding: 12px 24px;
  text-decoration: none;
  border-radius: 6px;
  display: inline-block;
  font-weight: bold;
`;

export const footerStyle = `
  color: #94a3b8;
  font-size: 12px;
  margin-top: 30px;
  border-top: 1px solid #e2e8f0;
  padding-top: 20px;
`;

export const getInvitationEmail = (role: string, setupLink: string) => `
<div style="${commonStyles}">
  <h2 style="color: #3b82f6;">Welcome to VantageFlow</h2>
  <p>You have been invited to join <strong>VantageFlow</strong> as a <strong>${role}</strong>.</p>
  <p>To get started, please set your password by clicking the button below:</p>
  <div style="margin: 30px 0;">
    <a href="${setupLink}" style="${buttonStyle}">
      Complete Account Setup
    </a>
  </div>
  <p style="color: #64748b; font-size: 14px;">
    This setup link will expire in <strong>48 hours</strong>. If you didn't expect this invitation, you can safely ignore this email.
  </p>
  <div style="${footerStyle}">
    VantageFlow - Project Management & KPI Dashboard
  </div>
</div>
`;

export const getReminderEmail = (role: string, setupLink: string) => `
<div style="${commonStyles}">
  <h2 style="color: #3b82f6;">Action Required: Complete Account Setup</h2>
  <p>You were invited to join <strong>VantageFlow</strong> as a <strong>${role}</strong>, but haven't set your password yet.</p>
  <p>To get started, please set your password by clicking the button below:</p>
  <div style="margin: 30px 0;">
    <a href="${setupLink}" style="${buttonStyle}">
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
  <div style="${footerStyle}">
    VantageFlow - Project Management & KPI Dashboard
  </div>
</div>
`;

export const getNewMemberEmail = (newMemberName: string, projectName: string, inviterName: string, link: string) => `
<div style="${commonStyles}">
  <h2 style="color: #3b82f6;">New Project Member</h2>
  <p><strong>${newMemberName}</strong> has been added to project <strong>${projectName}</strong> by ${inviterName}.</p>
  <div style="margin: 20px 0;">
    <a href="${link}" style="${buttonStyle}">
      View Project
    </a>
  </div>
  <div style="${footerStyle}">
    VantageFlow Team
  </div>
</div>
`;

export const getResponsibilityAssignedEmail = (itemType: string, itemName: string, projectName: string, assignerName: string, link: string) => `
<div style="${commonStyles}">
  <h2 style="color: #3b82f6;">New Assignment</h2>
  <p>You have been assigned to <strong>${itemType}: ${itemName}</strong> in project <strong>${projectName}</strong> by ${assignerName}.</p>
  <div style="margin: 20px 0;">
    <a href="${link}" style="${buttonStyle}">
      View Assignment
    </a>
  </div>
  <div style="${footerStyle}">
    VantageFlow Team
  </div>
</div>
`;

export const getAchievementEmail = (userName: string, points: number, description: string) => `
<div style="${commonStyles}">
   <h2 style="color: #3b82f6;">Achievement Unlocked!</h2>
   <p>Hi ${userName},</p>
   <p>You've just earned <strong>${points} points</strong> for:</p>
   <p style="font-size: 18px; font-weight: bold; color: #1e293b; background-color: #f1f5f9; padding: 15px; border-radius: 8px; border-left: 4px solid #3b82f6;">
     ${description}
   </p>
   <p>Keep up the great work!</p>
   <div style="${footerStyle}">
     VantageFlow Team
   </div>
</div>
`;

export const getProjectArchivedEmail = (projectName: string, actionBy: string, isArchived: boolean, link: string) => `
<div style="${commonStyles}">
   <h2 style="color: ${isArchived ? '#f59e0b' : '#22c55e'};">Project ${isArchived ? 'Archived' : 'Unarchived'}</h2>
   <p>The project <strong>${projectName}</strong> has been ${isArchived ? 'archived' : 'unarchived'} by ${actionBy}.</p>
   ${isArchived
    ? `<p style="color: #64748b;">No further edits can be made to this project until it is unarchived.</p>`
    : `<p style="color: #64748b;">The project is now active and can be edited again.</p>`
  }
   <div style="margin: 20px 0;">
     <a href="${link}" style="${buttonStyle}">
       View Project
     </a>
   </div>
   <div style="${footerStyle}">
     VantageFlow Team
   </div>
</div>
`;

export const getTaskImpedimentEmail = (
  taskName: string,
  projectName: string,
  reportedByName: string,
  category: string,
  description: string,
  link: string
) => `
<div style="${commonStyles}">
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
    <a href="${link}" style="${buttonStyle}">
      Review & Unblock Task
    </a>
  </div>
  <div style="${footerStyle}">
    VantageFlow - Feedback & Task Management
  </div>
</div>
`;

export const getTaskImpedimentResolvedEmail = (
  taskName: string,
  projectName: string,
  resolvedByName: string,
  resolutionNote: string,
  link: string
) => `
<div style="${commonStyles}">
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
    <a href="${link}" style="${buttonStyle}">
      View Task Progress
    </a>
  </div>
  <div style="${footerStyle}">
    VantageFlow - Feedback & Task Management
  </div>
</div>
`;

export const getTaskCompletedEmail = (
  taskName: string,
  projectName: string,
  completedByName: string,
  deliverablesSummary: string,
  link: string
) => `
<div style="${commonStyles}">
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
    <a href="${link}" style="${buttonStyle}">
      Review Completed Task
    </a>
  </div>
  <div style="${footerStyle}">
    VantageFlow - Feedback & Task Management
  </div>
</div>
`;

export const getTaskFeedbackEmail = (
  taskName: string,
  projectName: string,
  authorName: string,
  message: string,
  link: string
) => `
<div style="${commonStyles}">
  <h2 style="color: #3b82f6;">💬 New Task Note / Feedback</h2>
  <p><strong>${authorName}</strong> posted an update on <strong>${taskName}</strong> in project <strong>${projectName}</strong>:</p>
  <div style="background-color: #f8fafc; border-left: 4px solid #3b82f6; padding: 12px 16px; margin: 16px 0; border-radius: 4px;">
    <p style="margin: 0; color: #1e293b; font-size: 14px; line-height: 1.5;">"${message}"</p>
  </div>
  <div style="margin: 25px 0;">
    <a href="${link}" style="${buttonStyle}">
      View Task & Reply
    </a>
  </div>
  <div style="${footerStyle}">
    VantageFlow - Feedback & Task Management
  </div>
</div>
`;

