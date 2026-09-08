import { useState, useRef, useEffect } from "react";
import axios from "axios";
import { API_CONFIG } from "@/config/api";
import notify from "@/utils/notify";

interface FeedbackListProps {
  message_id: string;
  onClose: () => void;
}

const FeedbackList = ({ message_id, onClose }: FeedbackListProps) => {
  const feedbackRef = useRef<HTMLDivElement>(null);
  const [selectedOption, setSelectedOption] = useState<string>("");
  const [otherReason, setOtherReason] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const options = [
    "Not factually correct",
    "Didn't follow instructions",
    "Other(s)",
  ];

  // Scroll feedback list to top of viewport when it becomes visible
  useEffect(() => {
    if (feedbackRef.current) {
      feedbackRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
        inline: 'nearest'
      });
    }
  }, []);

  const handleOptionSelect = (option: string) => {
    setSelectedOption(option);
    if (option !== "Other(s)") {
      setOtherReason(""); // clear if switching back
    }
  };

  const handleSubmit = async () => {
    if (!selectedOption) {
      notify.error("Please select a feedback option");
      return;
    }

    if (selectedOption === "Other(s)" && !otherReason.trim()) {
      notify.error("Please enter your feedback");
      return;
    }

    setIsSubmitting(true);
    if(!message_id ){
      notify.error(`${!message_id ? "Message ID"  : "User ID"} are required`);
      return;
    }

    try {
      const res = await axios.post(
        `${API_CONFIG.LOCAL_API_BASE_URL}/feedback/`,
        {
          message_id,
          feedback_type: "thumbs_down",
          reason: selectedOption === "Other(s)" ? otherReason : selectedOption,
        },
        {
          headers: {
            "Content-Type": "application/json",
          },
          withCredentials: true,
          
        }
      );

      if (res.status === 201) {
        onClose();
      }
    } catch (error) {
      notify.error(error, "Error submitting feedback");
      console.error("Error submitting feedback", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div ref={feedbackRef} className="max-w-md pt-5 rounded-xl mb-10">
      {/* Title */}
      <h2
        className="text-xl font-semibold mb-1"
        style={{ color: "var(--color-text)" }}
      >
        What went wrong?
      </h2>
      <p
        className="text-sm mb-4"
        style={{ color: "var(--color-text)" }}
      >
        Your feedback helps make Newton better for everyone.
      </p>

      {/* Options */}
      <div className="space-y-2 mb-4">
        {options.map((option, idx) => (
          <div key={idx}>
            <button
              onClick={() => handleOptionSelect(option)}
              className={`w-full text-left px-4 py-3 rounded-lg transition ${
                selectedOption === option
                  ? "bg-slate-500 text-white"
                  : "bg-surface"
              }`}
            >
              {option}
            </button>
            {option === "Other(s)" && selectedOption === "Other(s)" && (
              <input
                type="text"
                value={otherReason}
                onChange={(e) => setOtherReason(e.target.value)}
                placeholder="Please specify..."
                className="mt-2 w-full px-4 py-2 rounded-lg bg-surface border outline-none"
              />
            )}
          </div>
        ))}
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2">
        <button
          onClick={onClose}
          className="flex-1 px-4 py-2 text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={
            !selectedOption ||
            isSubmitting ||
            (selectedOption === "Other(s)" && !otherReason.trim())
          }
          className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition"
        >
          {isSubmitting ? "Submitting..." : "Submit"}
        </button>
      </div>
    </div>
  );
};

export default FeedbackList;
