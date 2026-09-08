/** Format a parseable date string as `DD-MM-YYYY`. */
export const getFormattedDate = (date: string): string => {
  const parsedDate = new Date(Date.parse(date));
  const year = parsedDate.getFullYear();
  const month = String(parsedDate.getMonth() + 1).padStart(2, "0");
  const day = String(parsedDate.getDate()).padStart(2, "0");
  return `${day}-${month}-${year}`;
};

/** Format a date string as `YYYY-MM-DDTHH:mm` (required for datetime-local input). */
export const getFormattedDateTime = (dateTime: string | undefined): string => {
  if (!dateTime) return "";
  try {
    const parsedDate = new Date(dateTime);
    if (isNaN(parsedDate.getTime())) return "";

    const year = parsedDate.getFullYear();
    const month = String(parsedDate.getMonth() + 1).padStart(2, "0");
    const day = String(parsedDate.getDate()).padStart(2, "0");
    const hours = String(parsedDate.getHours()).padStart(2, "0");
    const minutes = String(parsedDate.getMinutes()).padStart(2, "0");

    return `${year}-${month}-${day}T${hours}:${minutes}`;
  } catch (error) {
    return "";
  }
};

/** Inclusive day count between two dates; 0 if invalid or reversed. */
export const calculateNumberOfDays = (
  startDate: string,
  endDate: string
): number => {
  if (!startDate || !endDate) return 0;

  const start = new Date(startDate);
  const end = new Date(endDate);

  // Ensure start date is not after end date
  if (start > end) return 0;

  const timeDifference = end.getTime() - start.getTime();
  // +1 to include both start and end dates
  return Math.ceil(timeDifference / (1000 * 60 * 60 * 24)) + 1;
};
