import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const EMAILS_BY_BUSINESS: Record<string, string[]> = {
  recruitment: ["noa@matarahr.co.il", "erezhindi@gmail.com"],
  carpentry: ["erezhindi@gmail.com"],
};

const BASE_URL = "https://matara-publisher.vercel.app";

export async function sendApprovalEmail(campaign: {
  id: string;
  title: string;
  content: string;
  business: { id: string; name: string; type: string };
  scheduledAt: Date | null;
}) {
  const approveUrl = `${BASE_URL}/campaigns/${campaign.id}`;
  const toEmails = EMAILS_BY_BUSINESS[campaign.business.type] || ["erezhindi@gmail.com"];

  const html = `
    <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0f0f0f; color: #fff; border-radius: 12px; overflow: hidden;">
      <div style="background: #1a1a2e; padding: 24px; border-bottom: 1px solid #333;">
        <h1 style="margin: 0; font-size: 20px; color: #fff;">קמפיין חדש ממתין לאישורך</h1>
        <p style="margin: 4px 0 0; color: #888; font-size: 14px;">${campaign.business.name}</p>
      </div>
      <div style="padding: 24px;">
        <h2 style="font-size: 18px; margin: 0 0 12px; color: #fff;">${campaign.title}</h2>
        <div style="background: #1a1a1a; border: 1px solid #333; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
          <pre style="white-space: pre-wrap; font-family: Arial; font-size: 14px; color: #ddd; margin: 0;">${campaign.content}</pre>
        </div>
        ${campaign.scheduledAt ? `<p style="color: #888; font-size: 13px;">מתוזמן: ${new Date(campaign.scheduledAt).toLocaleString("he-IL")}</p>` : ""}
        <a href="${approveUrl}" style="display: inline-block; background: #16a34a; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px; margin-top: 8px;">
          לצפייה ואישור הקמפיין
        </a>
      </div>
    </div>
  `;

  await resend.emails.send({
    from: "מטרה Publisher <onboarding@resend.dev>",
    to: toEmails,
    subject: `קמפיין חדש ממתין לאישור: ${campaign.title}`,
    html,
  });
}
