import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { AnimatedBackground } from "./components/AnimatedBackground";
import { BridgeScreen } from "./components/BridgeScreen";
import { Celebration } from "./components/Celebration";
import { FinaleScreen } from "./components/FinaleScreen";
import { FloatingHearts } from "./components/FloatingHearts";
import { GiftMemoryScreen } from "./components/GiftMemoryScreen";
import { IntroScreen } from "./components/IntroScreen";
import { ProposalScreen } from "./components/ProposalScreen";
import { QuestionCard } from "./components/QuestionCard";
import { RomanticMessageScreen } from "./components/RomanticMessageScreen";
import { Screen } from "./components/Screen";
import { SoundToggle } from "./components/SoundToggle";
import { QUESTIONS, TOTAL_QUESTIONS, pickMessages } from "./data/journey";
import { useFx } from "./hooks/useFx";
import { useSound } from "./hooks/useSound";

type Step =
  | { kind: "intro" }
  | { kind: "question"; index: number }
  | { kind: "message"; text: string }
  | { kind: "bridge" }
  | { kind: "memory" }
  | { kind: "proposal" }
  | { kind: "finale" };

const MESSAGES_SHOWN = 2;

/**
 * The story order. Two romantic notes are woven in at random positions so a
 * replay never plays out exactly the same, without ever feeling repetitive.
 */
function buildFlow(messages: string[]): Step[] {
  const flow: Step[] = [{ kind: "intro" }];
  QUESTIONS.forEach((_, index) => {
    flow.push({ kind: "question", index });
    const note = messages[index];
    if (note && index < QUESTIONS.length - 1) {
      flow.push({ kind: "message", text: note });
    }
  });
  flow.push(
    { kind: "bridge" },
    { kind: "memory" },
    { kind: "proposal" },
    { kind: "finale" },
  );
  return flow;
}

export function App() {
  const sound = useSound();
  const { canvasRef, api: fx } = useFx();

  const [messages, setMessages] = useState(() => pickMessages(MESSAGES_SHOWN));
  const flow = useMemo(() => buildFlow(messages), [messages]);
  const [stepIndex, setStepIndex] = useState(0);
  const [celebrating, setCelebrating] = useState(false);

  const step = flow[stepIndex];
  const finaleIndex = flow.length - 1;

  const advance = useCallback(() => {
    setStepIndex((current) => Math.min(current + 1, flow.length - 1));
  }, [flow.length]);

  // A soft whoosh under the two heaviest scene changes.
  useEffect(() => {
    if (stepIndex === 0) return;
    const target = flow[stepIndex];
    if (
      target.kind === "bridge" ||
      target.kind === "memory" ||
      target.kind === "proposal"
    ) {
      sound.engine.whoosh();
    }
  }, [flow, sound, stepIndex]);

  const handleAccept = useCallback(() => {
    setCelebrating(true);
  }, []);

  const handleCelebrationFinished = useCallback(() => {
    setCelebrating(false);
    setStepIndex(finaleIndex);
  }, [finaleIndex]);

  const handleReplay = useCallback(() => {
    fx.clearBursts();
    setMessages(pickMessages(MESSAGES_SHOWN));
    setStepIndex(0);
    setCelebrating(false);
  }, [fx]);

  const renderStep = () => {
    switch (step.kind) {
      case "intro":
        return (
          <Screen key="intro">
            <IntroScreen fx={fx} sound={sound} onBegin={advance} />
          </Screen>
        );

      case "question":
        return (
          <Screen key={`question-${step.index}`}>
            <QuestionCard
              question={QUESTIONS[step.index]}
              index={step.index}
              total={TOTAL_QUESTIONS}
              sound={sound}
              fx={fx}
              onAnswer={advance}
            />
          </Screen>
        );

      case "message":
        return (
          <Screen key={`message-${stepIndex}`}>
            <RomanticMessageScreen text={step.text} sound={sound} onDone={advance} />
          </Screen>
        );

      case "bridge":
        return (
          <Screen key="bridge" cinematic>
            <BridgeScreen sound={sound} onContinue={advance} />
          </Screen>
        );

      case "memory":
        return (
          <Screen key="memory" cinematic>
            <GiftMemoryScreen sound={sound} onContinue={advance} />
          </Screen>
        );

      case "proposal":
        return (
          <Screen key="proposal" cinematic>
            <ProposalScreen fx={fx} sound={sound} onAccept={handleAccept} />
          </Screen>
        );

      case "finale":
        return (
          <Screen key="finale" cinematic>
            <FinaleScreen sound={sound} fx={fx} onReplay={handleReplay} />
          </Screen>
        );
    }
  };

  return (
    <div className="app">
      <AnimatedBackground />
      <FloatingHearts />
      <canvas ref={canvasRef} className="fx-canvas" aria-hidden="true" />

      <SoundToggle enabled={sound.enabled} onToggle={sound.toggle} />

      <main className="stage">
        <AnimatePresence mode="wait">
          {celebrating ? (
            <Celebration key="celebration" fx={fx} onFinished={handleCelebrationFinished} />
          ) : (
            renderStep()
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
