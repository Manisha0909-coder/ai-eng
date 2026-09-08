import type { Meeting } from "../types";

/** Read a File as a base64 string (without the data-URL prefix). */
export const toBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result.split(",")[1]);
      } else {
        reject(new Error("Failed to convert file to base64"));
      }
    };
    reader.onerror = (error) => reject(error);
  });

/** Build a Graph `events` payload from meeting form data. */
export const generateMeetingPayload = (meeting: Meeting) => {
  const {
    date,
    start_time,
    duration,
    time_zone,
    subject,
    content,
    venue,
    emails,
    usernames,
  } = meeting;

  const startDateTime = `${date}T${start_time}`;
  const startDate = new Date(`${date}T${start_time}Z`);
  const endDate = new Date(startDate);
  endDate.setUTCHours(startDate.getUTCHours() + Number(duration.hours));
  endDate.setUTCMinutes(startDate.getUTCMinutes() + Number(duration.minutes));
  const endDateTime = endDate.toISOString().replace(".000Z", "");

  const emailList: string[] = emails.split(",").map((e: string) => e.trim());
  const nameList = usernames.split(",").map((n: string) => n.trim());

  const attendees = emailList.map((email: string, i) => ({
    emailAddress: {
      address: email,
      name: nameList[i] || "",
    },
    type: "required",
  }));

  return {
    subject: subject,
    body: {
      contentType: "HTML",
      content: content,
    },
    start: {
      dateTime: startDateTime,
      timeZone: time_zone,
    },
    end: {
      dateTime: endDateTime,
      timeZone: time_zone,
    },
    location: {
      displayName: venue,
    },
    attendees: attendees,
    allowNewTimeProposals: true,
    transactionId: `MEET-${date.replace(/-/g, "")}-${start_time.replace(
      /:/g,
      ""
    )}`,
  };
};

/** Build a Graph `sendMail` payload, flagged with a due date of Friday 5 PM. */
export const generateSendEmailPayload = (emailData: {
  toRecipients: string;
  ccRecipients: string[];
  subject: string;
  body: string;
}) => {
  const { toRecipients, subject, body } = emailData;

  // Calculate start date (now) and due date (Friday of current week)
  const now = new Date();
  const dueDate = new Date();

  // Set due date to Friday of current week at 5 PM
  dueDate.setDate(now.getDate() + (5 - now.getDay())); // 5 is Friday (0 is Sunday)
  dueDate.setHours(17, 0, 0, 0); // 5 PM

  return {
    subject: subject,
    toRecipients: [
      {
        emailAddress: {
          address: toRecipients,
        },
      },
    ],
    flag: {
      flagStatus: "flagged",
      startDateTime: {
        dateTime: now.toISOString(),
        timeZone: "UTC", // or "Eastern Standard Time" if needed
      },
      dueDateTime: {
        dateTime: dueDate.toISOString(),
        timeZone: "UTC", // or "Eastern Standard Time" if needed
      },
    },
    body: {
      contentType: "HTML",
      content: body,
    },
  };
};
