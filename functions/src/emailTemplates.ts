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

export const getInvitationEmail = (role: string, resetLink: string) => `
<div style="${commonStyles}">
  <h2 style="color: #3b82f6;">Welcome to VantageFlow</h2>
  <p>You have been invited to join <strong>VantageFlow</strong> as a <strong>${role}</strong>.</p>
  <p>To get started, please set your password by clicking the button below:</p>
  <div style="margin: 30px 0;">
    <a href="${resetLink}" style="${buttonStyle}">
      Set Your Password
    </a>
  </div>
  <p style="color: #64748b; font-size: 14px;">
    This link will expire in 24 hours. If you didn't expect this invitation, you can safely ignore this email.
  </p>
  <div style="${footerStyle}">
    VantageFlow - Project Management & KPI Dashboard
  </div>
</div>
`;

export const getReminderEmail = (role: string, resetLink: string) => `
<div style="${commonStyles}">
  <h2 style="color: #3b82f6;">Action Required: Complete Account Setup</h2>
  <p>You were invited to join <strong>VantageFlow</strong> as a <strong>${role}</strong>, but haven't set your password yet.</p>
  <p>To get started, please set your password by clicking the button below:</p>
  <div style="margin: 30px 0;">
    <a href="${resetLink}" style="${buttonStyle}">
      Set Your Password
    </a>
  </div>
  <div style="background-color: #fef3c7; border: 1px solid #f59e0b; border-radius: 6px; padding: 12px; margin: 20px 0;">
    <p style="color: #92400e; font-size: 13px; margin: 0;">
      <strong>Important:</strong> If you received multiple emails, please use the link from this most recent email. Previous links are no longer valid.
    </p>
  </div>
  <p style="color: #64748b; font-size: 14px;">
    This link will expire in 24 hours. If you didn't expect this email, you can safely ignore it.
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
