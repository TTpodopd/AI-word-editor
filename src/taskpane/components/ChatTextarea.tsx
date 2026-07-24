import React, { forwardRef, useImperativeHandle, useRef } from "react";

export interface ChatTextareaHandle {
  focus: () => void;
  focusEnd: () => void;
  getValue: () => string;
  clear: () => void;
  setValue: (value: string) => void;
}

export interface ChatTextareaListeners {
  onValueChange: (value: string) => void;
  onEnter: () => void;
}

interface ChatTextareaProps {
  disabled: boolean;
  placeholder: string;
  height: number;
  listenersRef: React.RefObject<ChatTextareaListeners>;
}

function propsEqual(prev: ChatTextareaProps, next: ChatTextareaProps) {
  return (
    prev.disabled === next.disabled &&
    prev.placeholder === next.placeholder &&
    prev.height === next.height &&
    prev.listenersRef === next.listenersRef
  );
}

export const ChatTextarea = React.memo(
  forwardRef<ChatTextareaHandle, ChatTextareaProps>(function ChatTextarea(
    { disabled, placeholder, height, listenersRef },
    ref
  ) {
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const isComposingRef = useRef(false);

    useImperativeHandle(ref, () => ({
      focus: () => {
        textareaRef.current?.focus();
      },
      focusEnd: () => {
        const textarea = textareaRef.current;
        if (!textarea) return;
        textarea.focus({ preventScroll: true });
        const end = textarea.value.length;
        textarea.setSelectionRange(end, end);
      },
      getValue: () => textareaRef.current?.value ?? "",
      clear: () => {
        if (textareaRef.current) textareaRef.current.value = "";
        listenersRef.current?.onValueChange("");
      },
      setValue: (value: string) => {
        if (textareaRef.current) textareaRef.current.value = value;
        listenersRef.current?.onValueChange(value);
      },
    }));

    return (
      <textarea
        ref={textareaRef}
        className="chat-input"
        placeholder={placeholder}
        defaultValue=""
        lang="zh-CN"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        onChange={(e) => {
          if (isComposingRef.current) return;
          listenersRef.current?.onValueChange(e.target.value);
        }}
        onCompositionStart={() => {
          isComposingRef.current = true;
        }}
        onCompositionEnd={(e) => {
          isComposingRef.current = false;
          listenersRef.current?.onValueChange(e.currentTarget.value);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            if (e.nativeEvent.isComposing || isComposingRef.current || e.keyCode === 229) {
              return;
            }
            e.preventDefault();
            listenersRef.current?.onEnter();
          }
        }}
        disabled={disabled}
        style={{ height }}
      />
    );
  }),
  propsEqual
);
