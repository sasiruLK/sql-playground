"use client";

import { useEffect, useRef } from "react";
import { EditorView, keymap, placeholder as placeholderExt } from "@codemirror/view";
import { EditorState, Compartment } from "@codemirror/state";
import { sql, SQLite } from "@codemirror/lang-sql";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { autocompletion, completionKeymap } from "@codemirror/autocomplete";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags } from "@lezer/highlight";
import type { TableInfo } from "@/lib/types";

/**
 * Colours come from the shadcn palette rather than a canned CodeMirror theme,
 * so the editor follows the light/dark switch with the rest of the page.
 */
const highlight = HighlightStyle.define([
  { tag: tags.keyword, color: "var(--cm-keyword)", fontWeight: "500" },
  { tag: tags.string, color: "var(--cm-string)" },
  { tag: tags.number, color: "var(--cm-number)" },
  { tag: [tags.function(tags.variableName), tags.standard(tags.name)], color: "var(--cm-function)" },
  { tag: tags.comment, color: "var(--muted-foreground)", fontStyle: "italic" },
  { tag: tags.operator, color: "var(--cm-operator)" },
  { tag: [tags.punctuation, tags.separator], color: "var(--muted-foreground)" },
  { tag: tags.null, color: "var(--cm-keyword)" },
]);

const theme = EditorView.theme({
  "&": {
    fontSize: "13px",
    backgroundColor: "transparent",
    color: "var(--foreground)",
  },
  "&.cm-focused": { outline: "none" },
  ".cm-content": {
    fontFamily: "var(--font-mono)",
    padding: "12px 0",
    caretColor: "var(--foreground)",
    minHeight: "168px",
    lineHeight: "1.7",
  },
  ".cm-line": { padding: "0 2px" },
  ".cm-placeholder": { color: "var(--muted-foreground)" },
  ".cm-cursor": { borderLeftColor: "var(--foreground)", borderLeftWidth: "2px" },
  ".cm-selectionBackground, &.cm-focused .cm-selectionBackground, ::selection": {
    backgroundColor: "color-mix(in oklch, var(--primary) 18%, transparent)",
  },
  ".cm-tooltip": { border: "none", backgroundColor: "transparent" },
  ".cm-tooltip-autocomplete": {
    fontFamily: "var(--font-mono)",
    fontSize: "12px",
  },
  ".cm-tooltip-autocomplete > ul": {
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-md)",
    backgroundColor: "var(--popover)",
    color: "var(--popover-foreground)",
    boxShadow: "0 8px 24px oklch(0 0 0 / 0.12)",
    maxHeight: "16rem",
    padding: "4px",
  },
  ".cm-tooltip-autocomplete > ul > li": {
    borderRadius: "var(--radius-sm)",
    padding: "4px 8px",
  },
  ".cm-tooltip-autocomplete > ul > li[aria-selected]": {
    backgroundColor: "var(--accent)",
    color: "var(--accent-foreground)",
  },
  ".cm-completionIcon": { display: "none" },
  ".cm-completionDetail": { color: "var(--muted-foreground)", fontStyle: "normal" },
});

/** Turns the live schema into CodeMirror's table/column completion source. */
function schemaConfig(schema: TableInfo[]) {
  return Object.fromEntries(
    schema.map((table) => [table.name, table.columns.map((column) => column.name)]),
  );
}

export function SqlEditor({
  value,
  onChange,
  onRun,
  schema,
}: {
  value: string;
  onChange: (value: string) => void;
  onRun: () => void;
  schema: TableInfo[];
}) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const language = useRef(new Compartment());
  // Keeps the Cmd+Enter handler pointing at the latest closure without
  // rebuilding the editor on every render.
  const runRef = useRef(onRun);
  runRef.current = onRun;

  useEffect(() => {
    if (!host.current) return;

    const editor = new EditorView({
      parent: host.current,
      state: EditorState.create({
        doc: value,
        extensions: [
          history(),
          autocompletion({ activateOnTyping: true }),
          keymap.of([
            {
              key: "Mod-Enter",
              preventDefault: true,
              run: () => {
                runRef.current();
                return true;
              },
            },
            ...completionKeymap,
            ...historyKeymap,
            ...defaultKeymap,
          ]),
          language.current.of(sql({ dialect: SQLite, upperCaseKeywords: false })),
          syntaxHighlighting(highlight),
          EditorView.lineWrapping,
          placeholderExt("Write any SQL here, then press Run."),
          theme,
          EditorView.updateListener.of((update) => {
            if (update.docChanged) {
              onChange(update.state.doc.toString());
            }
          }),
        ],
      }),
    });

    view.current = editor;
    return () => {
      editor.destroy();
      view.current = null;
    };
    // Built once: later prop changes are pushed in through the effects below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reflect programmatic changes (samples, history, reset) into the document.
  useEffect(() => {
    const editor = view.current;
    if (!editor || editor.state.doc.toString() === value) return;

    editor.dispatch({
      changes: { from: 0, to: editor.state.doc.length, insert: value },
    });
  }, [value]);

  // Re-teach autocomplete the schema whenever DDL changes it.
  useEffect(() => {
    const editor = view.current;
    if (!editor || schema.length === 0) return;

    editor.dispatch({
      effects: language.current.reconfigure(
        sql({
          dialect: SQLite,
          upperCaseKeywords: false,
          schema: schemaConfig(schema),
        }),
      ),
    });
  }, [schema]);

  return <div className="px-4" data-testid="sql-editor" ref={host} />;
}
