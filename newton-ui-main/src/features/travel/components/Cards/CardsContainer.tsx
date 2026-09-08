import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import Card from './ResourceCard';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";

type ContentItem = {
  image?: { type: "url"; value: string };
  title?: { type: "text"; value: string };
  description?: { type: "text"; value: string };
  footer?: { type: "text"; value: string };
  metadata?: {
    linkUrl?: string;
    variant?: string;
    interactionType?: "link" | "button";
    departureToken?: string;
  };
};

interface CardsContainerProps {
  cards: Array<{
    id: string;
    type: "card";
    orientation: "portrait" | "landscape";
    category?: "flight" | "hotel" | "restaurant" | string;
    content: ContentItem[] | ContentItem;
    metadata?: {
      linkUrl?: string;
      variant?: string;
      interactionType?: "link" | "button";
      departureToken?: string;
    };
  }>;
  className?: string;
}

const CardsContainer: React.FC<CardsContainerProps> = ({ cards, className = "" }) => {
  if (!cards || cards.length === 0) {
    return null;
  }

  // Derive category list from incoming cards (without "All")
  const categories = useMemo(() => {
    const unique = Array.from(
      new Set(
        cards
          .map((c) => (c.category ? String(c.category) : ""))
          .filter((c) => c && c.trim().length > 0)
      )
    );
    return unique;
  }, [cards]);

  const [selectedCategory, setSelectedCategory] = useState<string>(() => {
    // Default to "Hotels" if available, otherwise first category
    const hotelsCategory = categories.find(cat => cat.toLowerCase() === "hotels");
    return hotelsCategory || categories[0] || "";
  });

  const filteredCards = useMemo(() => {
    // First filter out any invalid cards (missing required content)
    const validCards = cards.filter(card => 
      card && card.content && (
        // Array of content or single content
        (Array.isArray(card.content) && card.content.length > 0) ||
        (!Array.isArray(card.content) && (
          (card.content.title && card.content.title.value) ||
          (card.content.image && card.content.image.value)
        ))
      )
    ).map(card => {
      // Normalize orientation to handle typos (potrait -> portrait)
      let normalizedOrientation = card.orientation || "landscape";
      if (typeof normalizedOrientation === 'string' && normalizedOrientation.toLowerCase() === "potrait") {
        normalizedOrientation = "portrait" as "portrait" | "landscape";
      }
      return {
        ...card,
        orientation: normalizedOrientation
      };
    });
    
    // Then filter by category if selected
    if (!selectedCategory) return validCards;
    return validCards.filter((c) => String(c.category) === selectedCategory);
  }, [cards, selectedCategory]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`w-full max-w-full md:max-w-[800px] ${className}`}
      style={{ 
        contain: "layout",
        minHeight: "200px",
        marginTop: "16px",
        marginBottom: "8px",
        position: "relative",
        zIndex: 1,
        overflow: "visible"
      }}
    >
      {/* Header */}
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-text-main">
          {selectedCategory} Recommendations
        </h3>
        <p className="text-sm opacity-70 mt-1 text-text-main">
          {filteredCards.length} option{filteredCards.length !== 1 ? 's' : ''} found
        </p>
      </div>

      {/* Category Filters */}
      {categories.length > 0 && (
        <div className="mb-3 flex items-center gap-2 overflow-x-auto no-scrollbar">
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`whitespace-nowrap rounded-full border px-3 py-1 text-xs md:text-sm transition-colors ${
                selectedCategory === cat
                  ? "bg-text-main text-background border-text-main hover:bg-text-main/90"
                  : "bg-surface text-text-main border-border-main hover:bg-surface-2"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      {/* Cards Carousel */}
      <div className="relative w-full overflow-hidden px-4 sm:px-6 lg:px-8">
        <Carousel className="w-full pb-12">
          <CarouselContent className="-ml-3">
            {filteredCards.map((card) => {
              const linkUrl = card.metadata?.linkUrl;
              const interactionType = card.metadata?.interactionType;

              return (
                <CarouselItem
                  key={card.id}
                  className="basis-full pl-3 sm:basis-1/2 lg:basis-1/3"
                >
                  <Card
                    id={card.id}
                    content={card.content}
                    orientation={card.orientation}
                    category={card.category}
                    className="h-full w-full"
                    onClick={() => {
                      if (linkUrl && (interactionType === "link" || interactionType === undefined)) {
                        window.open(linkUrl, '_blank', 'noopener,noreferrer');
                      }
                    }}
                  />
                </CarouselItem>
              );
            })}
          </CarouselContent>
          {filteredCards.length > 1 && (
            <div className="absolute bottom-1.5 left-0 right-0 pb-10">
              <CarouselPrevious
                variant="ghost"
                className="left-2 top-1/2 z-10 h-8 w-8 -translate-y-1/2 border-none bg-text-main/50 text-background shadow-lg hover:bg-text-main/70 hover:text-background/90 sm:h-10 sm:w-10"
              />
              <CarouselNext
                variant="ghost"
                className="right-2 top-1/2 z-10 h-8 w-8 -translate-y-1/2 border-none bg-text-main/50 text-background shadow-lg hover:bg-text-main/70 hover:text-background/90 sm:h-10 sm:w-10"
              />
            </div>
          )}
        </Carousel>
      </div>
    </motion.div>
  );
};

export default CardsContainer;
