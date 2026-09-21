import { useCallback, useRef } from "react";
import Editor, { type OnMount, type BeforeMount } from "@monaco-editor/react";
import type * as Monaco from "monaco-editor";
import { useTheme } from "@/lib/theme";

interface CodeEditorProps {
  value: string;
  onChange: (next: string) => void;
  readOnly?: boolean;
  onSave?: () => void;
  theme?: "dark" | "light";
}

export function CodeEditor({
  value,
  onChange,
  readOnly = false,
  onSave,
  theme: explicitTheme,
}: CodeEditorProps) {
  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);
  const contextTheme = useTheme();
  const currentTheme = explicitTheme ?? contextTheme.theme;
  const isLight = currentTheme === "light";

  const handleBeforeMount: BeforeMount = (monaco) => {
    // Define a custom technical terminal theme for SYSTEM FAILURE (Dark)
    monaco.editor.defineTheme("system-failure-dark", {
      base: "vs-dark",
      inherit: true,
      rules: [
        { token: "comment", foreground: "4b6356", fontStyle: "italic" },
        { token: "keyword", foreground: "10b981", fontStyle: "bold" },
        { token: "identifier", foreground: "d1fae5" },
        { token: "type", foreground: "34d399" },
        { token: "string", foreground: "f59e0b" },
        { token: "number", foreground: "fbbf24" },
        { token: "delimiter", foreground: "6ee7b7" },
      ],
      colors: {
        "editor.background": "#050d09",
        "editor.foreground": "#e2e8f0",
        "editor.lineHighlightBackground": "#091c13",
        "editorLineNumber.foreground": "#2d4a3b",
        "editorLineNumber.activeForeground": "#10b981",
        "editorCursor.foreground": "#34d399",
        "editor.selectionBackground": "#0d3824",
        "editor.inactiveSelectionBackground": "#072417",
      },
    });

    // Define daylight technical instrumentation theme for SYSTEM FAILURE (Light)
    monaco.editor.defineTheme("system-failure-light", {
      base: "vs",
      inherit: true,
      rules: [
        { token: "comment", foreground: "64748b", fontStyle: "italic" },
        { token: "keyword", foreground: "047857", fontStyle: "bold" },
        { token: "identifier", foreground: "0f172a" },
        { token: "type", foreground: "0d9488" },
        { token: "string", foreground: "b45309" },
        { token: "number", foreground: "d97706" },
        { token: "delimiter", foreground: "0f766e" },
      ],
      colors: {
        "editor.background": "#f8fafc",
        "editor.foreground": "#0f172a",
        "editor.lineHighlightBackground": "#f1f5f9",
        "editorLineNumber.foreground": "#94a3b8",
        "editorLineNumber.activeForeground": "#047857",
        "editorCursor.foreground": "#047857",
        "editor.selectionBackground": "#bbf7d0",
        "editor.inactiveSelectionBackground": "#e2e8f0",
      },
    });
  };

  const handleOnMount: OnMount = useCallback(
    (editor, monaco) => {
      editorRef.current = editor;

      // Intercept Ctrl+S / Cmd+S
      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
        if (onSave) {
          onSave();
        }
      });
    },
    [onSave]
  );

  return (
    <div
      className={`panel-frame relative h-full min-h-[360px] w-full overflow-hidden rounded-sm border border-border/80 transition-colors ${
        isLight ? "bg-[#f8fafc]" : "bg-[#050d09]"
      }`}
    >
      <Editor
        height="100%"
        width="100%"
        language="c"
        theme={isLight ? "system-failure-light" : "system-failure-dark"}
        value={value}
        onChange={(val) => onChange(val ?? "")}
        beforeMount={handleBeforeMount}
        onMount={handleOnMount}
        loading={
          <div
            className={`flex h-full min-h-[360px] w-full items-center justify-center font-mono text-xs text-primary ${
              isLight ? "bg-[#f8fafc]" : "bg-[#050d09]"
            }`}
          >
            <span className="animate-pulse">▶ INITIALIZING MONACO C-KERNEL...</span>
          </div>
        }
        options={{
          readOnly,
          lineNumbers: "on",
          lineNumbersMinChars: 3,
          glyphMargin: false,
          folding: true,
          minimap: { enabled: false },
          fontSize: 13,
          fontFamily: "'JetBrains Mono', 'Fira Code', 'Courier New', monospace",
          fontLigatures: true,
          automaticLayout: true,
          autoClosingBrackets: "always",
          autoClosingQuotes: "always",
          formatOnPaste: false,
          formatOnType: false,
          tabSize: 4,
          insertSpaces: true,
          scrollBeyondLastLine: false,
          contextmenu: true,
          renderWhitespace: "selection",
          scrollbar: {
            verticalScrollbarSize: 8,
            horizontalScrollbarSize: 8,
          },
        }}
      />
    </div>
  );
}
