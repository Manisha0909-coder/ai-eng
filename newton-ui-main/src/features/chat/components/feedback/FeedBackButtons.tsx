import { ThumbsDown, ThumbsUp, Sparkles } from "lucide-react";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import axios from "axios";
import { API_CONFIG } from "@/config/api";
import notify from "@/utils/notify";
import { useStore } from "@/store/useStore";

interface FeedBackButtonsProps {
    message_id: string;
    thumbsDownClicked: boolean;
    setThumbsDownClicked: (value: boolean) => void;
}
type FeedBackType = "thumbs_up" | "thumbs_down";


const FeedBackButtons = ({
    thumbsDownClicked,
    message_id,
    setThumbsDownClicked,
}: FeedBackButtonsProps) => {

    const [thumbsUpClicked, setThumbsUpClicked] = useState<boolean>(false);
    const [feedbackType, setFeedbackType] = useState<FeedBackType>("thumbs_up");
    const userId = useStore((state) => state.userId);
    const handleThumbsUpClick = async () => {
        if (!userId) {
            notify.error("User information missing");
            return;
        }
        setFeedbackType("thumbs_up");
        setThumbsUpClicked(true);

        try {
            await axios.post(`${API_CONFIG.LOCAL_API_BASE_URL}/feedback/`, {
                "user_id": userId,
                "message_id": message_id,
                "feedback_type": feedbackType,
                "reason": "Great Response"
            }, {
               withCredentials: true,
               headers: {
                "Content-Type": "application/json",
               },
            })

        } catch (error) {
            notify.error(error, "Error in thumbs up feedback");
            console.error("Error in thumbs up feedback", error);
            setThumbsUpClicked(false);

        }

    };


    

    return (
        <div className="flex items-center gap-1 shrink-0 relative">
            {/* Thumbs Up */}
            <motion.div
                onClick={handleThumbsUpClick}
                whileTap={{ scale: 0.9 }}
                animate={thumbsUpClicked ? { scale: [1, 1.3, 1] } : {}}
                transition={{ duration: 0.4 }}
                className="relative cursor-pointer w-8 h-8 shrink-0 rounded-lg border border-transparent flex items-center justify-center text-text-muted hover:bg-surface-2 hover:border-border-main hover:text-status-success transition-all"
                aria-label="Helpful"
                title="Helpful"
            >
                <ThumbsUp
                    size={14}
                    className={`${thumbsUpClicked ? "text-status-success" : "" 
                        } transition-colors 
`}
                />

                {/* Green stars burst */}
                <AnimatePresence>
                    {thumbsUpClicked && (
                        <>
                            {[...Array(8)].map((_, i) => (
                                <motion.div
                                    key={i}
                                    initial={{ opacity: 1, scale: 0, x: 0, y: 0 }}
                                    animate={{
                                        opacity: [1, 1, 0],
                                        scale: [0, 1.2, 0],
                                        x: (Math.random() - 0.5) * 60, // spread radius
                                        y: (Math.random() - 0.5) * 60,
                                        rotate: Math.random() * 180,
                                    }}
                                    exit={{ opacity: 0 }}
                                    transition={{ duration: 0.8, ease: "easeOut" }}
                                    className="absolute top-1/2 left-1/2"
                                >
                                    <Sparkles size={12} className="text-green-400" />
                                </motion.div>
                            ))}
                        </>
                    )}
                </AnimatePresence>
            </motion.div>

            {/* Thumbs Down */}
            <motion.div
                whileTap={{ scale: 0.9 }}
                animate={thumbsDownClicked ? { scale: [1, 1.3, 1] } : {}}
                transition={{ duration: 0.4 }}
                onClick={() => {
                    setThumbsDownClicked(true)
                }}
                className="cursor-pointer relative w-8 h-8 shrink-0 rounded-lg border border-transparent flex items-center justify-center text-text-muted hover:bg-surface-2 hover:border-border-main hover:text-status-error transition-all"
                aria-label="Not helpful"
                title="Not helpful"
            >
                <ThumbsDown
                    size={14}
                    className={`${thumbsDownClicked ? "text-status-error" : ""} transition-colors`}
                />
            </motion.div>
        </div>



    );
};

export default FeedBackButtons;
