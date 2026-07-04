import { useState } from "react";
import { ChevronDown, Star } from "lucide-react";

import {
  FAQ_CATEGORIES,
  FAQ_ITEMS,
  type FaqCategory,
  type FaqItem,
} from "../data/supportData";

type FaqSectionProps = {
  onAskAI: (context: string) => void;
};

export function FaqSection({ onAskAI }: FaqSectionProps) {
  const [activeCategory, setActiveCategory] = useState<FaqCategory | "인기">("인기");
  const [openItemId, setOpenItemId] = useState<string | null>(null);

  const displayedItems: FaqItem[] =
    activeCategory === "인기"
      ? FAQ_ITEMS.filter((f) => f.popular)
      : FAQ_ITEMS.filter((f) => f.category === activeCategory);

  function toggleItem(id: string) {
    setOpenItemId((prev) => (prev === id ? null : id));
  }

  return (
    <div className="support-faq">
      {/* Category tabs */}
      <div className="support-faq-tabs" role="tablist" aria-label="FAQ 카테고리">
        <button
          role="tab"
          aria-selected={activeCategory === "인기"}
          className={`support-faq-tab${activeCategory === "인기" ? " active" : ""}`}
          onClick={() => {
            setActiveCategory("인기");
            setOpenItemId(null);
          }}
          type="button"
        >
          <Star size={12} aria-hidden="true" />
          인기
        </button>
        {FAQ_CATEGORIES.map((cat) => (
          <button
            key={cat}
            role="tab"
            aria-selected={activeCategory === cat}
            className={`support-faq-tab${activeCategory === cat ? " active" : ""}`}
            onClick={() => {
              setActiveCategory(cat);
              setOpenItemId(null);
            }}
            type="button"
          >
            {cat}
          </button>
        ))}
      </div>

      {/* FAQ list */}
      <div className="support-faq-list" role="tabpanel">
        {displayedItems.length === 0 ? (
          <div className="support-empty">
            <p>해당 카테고리에 FAQ가 없습니다.</p>
          </div>
        ) : (
          displayedItems.map((item) => (
            <div
              key={item.id}
              className={`support-faq-item${openItemId === item.id ? " open" : ""}`}
            >
              <button
                aria-expanded={openItemId === item.id}
                className="support-faq-question"
                onClick={() => toggleItem(item.id)}
                type="button"
              >
                <span>{item.question}</span>
                <ChevronDown
                  size={15}
                  aria-hidden="true"
                  className={`support-faq-chevron${openItemId === item.id ? " rotated" : ""}`}
                />
              </button>
              {openItemId === item.id ? (
                <div className="support-faq-answer" role="region">
                  <p>{item.answer}</p>
                  <button
                    className="support-faq-ask-ai btn-outline kds-btn-sm"
                    onClick={() => onAskAI(`FAQ: ${item.question}\n${item.answer}`)}
                    type="button"
                  >
                    AI에게 추가 질문
                  </button>
                </div>
              ) : null}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
