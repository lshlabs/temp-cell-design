import { useState } from "react";
import { ArrowLeft, CheckCircle } from "lucide-react";

import {
  QNA_INITIAL_OPTIONS,
  QNA_STEPS,
  type QnaOption,
  type QnaStep,
} from "../data/supportData";
import type { QnaPathEntry } from "../types/support";

type QnaFlowProps = {
  onSwitchToAI: (path: QnaPathEntry[]) => void;
  onConnectAgent: (path: QnaPathEntry[]) => void;
  onResolved: () => void;
};

type QnaState =
  | { kind: "initial" }
  | { kind: "step"; step: QnaStep; answer?: string }
  | { kind: "resolved" };

export function QnaFlow({ onSwitchToAI, onConnectAgent, onResolved }: QnaFlowProps) {
  const [path, setPath] = useState<QnaPathEntry[]>([]);
  const [state, setState] = useState<QnaState>({ kind: "initial" });

  function handleInitialOption(option: QnaOption) {
    if (option.terminal === "agent") {
      const newPath: QnaPathEntry[] = [
        { stepId: "initial", question: "어떻게 도와드릴까요?", selectedOptionLabel: option.label },
      ];
      onConnectAgent(newPath);
      return;
    }
    if (option.terminal === "ai") {
      const newPath: QnaPathEntry[] = [
        { stepId: "initial", question: "어떻게 도와드릴까요?", selectedOptionLabel: option.label },
      ];
      onSwitchToAI(newPath);
      return;
    }
    if (option.nextStepId) {
      const newPath: QnaPathEntry[] = [
        { stepId: "initial", question: "어떻게 도와드릴까요?", selectedOptionLabel: option.label },
      ];
      setPath(newPath);
      const step = QNA_STEPS[option.nextStepId];
      if (step) setState({ kind: "step", step });
    }
  }

  function handleStepOption(option: QnaOption, currentStep: QnaStep) {
    const newEntry: QnaPathEntry = {
      stepId: currentStep.id,
      question: currentStep.question,
      selectedOptionLabel: option.label,
    };
    const newPath = [...path, newEntry];

    if (option.terminal === "resolved") {
      onResolved();
      return;
    }
    if (option.terminal === "agent") {
      onConnectAgent(newPath);
      return;
    }
    if (option.terminal === "ai") {
      onSwitchToAI(newPath);
      return;
    }

    if (option.answer && option.nextStepId) {
      setPath(newPath);
      const step = QNA_STEPS[option.nextStepId];
      if (step) setState({ kind: "step", step, answer: option.answer });
      return;
    }

    if (option.nextStepId) {
      setPath(newPath);
      const step = QNA_STEPS[option.nextStepId];
      if (step) setState({ kind: "step", step });
    }
  }

  function handleBack() {
    if (path.length === 0) return;
    if (path.length === 1) {
      setPath([]);
      setState({ kind: "initial" });
      return;
    }
    const newPath = path.slice(0, -1);
    const prevEntry = newPath[newPath.length - 1];
    const step = QNA_STEPS[prevEntry.stepId] ?? QNA_STEPS[path[path.length - 1].stepId];
    // Go back to the step that produced the last entry
    const parentEntry = path[path.length - 2];
    const parentStep = QNA_STEPS[parentEntry?.stepId ?? ""] ?? null;
    setPath(newPath);
    if (parentStep) {
      setState({ kind: "step", step: parentStep });
    } else {
      setState({ kind: "initial" });
    }
  }

  if (state.kind === "initial") {
    return (
      <div className="support-qna">
        <div className="support-qna-header">
          <p className="support-qna-question">어떻게 도와드릴까요?</p>
        </div>
        <div className="support-qna-options">
          {QNA_INITIAL_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              className="support-qna-option"
              onClick={() => handleInitialOption(opt)}
              type="button"
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (state.kind === "step") {
    const { step, answer } = state;
    return (
      <div className="support-qna">
        {/* Breadcrumb path */}
        {path.length > 0 ? (
          <div className="support-qna-path" aria-label="선택 경로">
            {path.map((entry, i) => (
              <span key={i} className="support-qna-path-entry">
                {i > 0 ? <span className="support-qna-path-sep" aria-hidden="true"> › </span> : null}
                {entry.selectedOptionLabel}
              </span>
            ))}
          </div>
        ) : null}

        {/* Back button */}
        <button
          className="support-qna-back kds-btn-ghost kds-btn-sm"
          onClick={handleBack}
          type="button"
        >
          <ArrowLeft size={13} aria-hidden="true" />
          이전
        </button>

        {/* Answer card (if this step shows an answer first) */}
        {answer ? (
          <div className="support-qna-answer-card">
            {answer.split("\n").map((line, i) => (
              <p key={i}>{line}</p>
            ))}
          </div>
        ) : null}

        {/* Next question */}
        <div className="support-qna-header">
          <p className="support-qna-question">{step.question}</p>
        </div>
        <div className="support-qna-options">
          {step.options.map((opt) => (
            <button
              key={opt.id}
              className={`support-qna-option${
                opt.terminal === "resolved"
                  ? " resolved"
                  : opt.terminal === "agent"
                  ? " agent"
                  : opt.terminal === "ai"
                  ? " ai"
                  : ""
              }`}
              onClick={() => handleStepOption(opt, step)}
              type="button"
            >
              {opt.terminal === "resolved" ? (
                <CheckCircle size={14} aria-hidden="true" />
              ) : null}
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return null;
}
