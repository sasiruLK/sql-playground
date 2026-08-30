"use client";

import { useEffect, useRef } from "react";
import { EditorView, keymap, placeholder as placeholderExt } from "@codemirror/view";
import { EditorState, Compartment } from "@codemirror/state";
import { sql, SQLite } from "@codemirror/lang-sql";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { autocompletion, completionKeymap } from "@codemirror/autocomplete";
import type { TableInfo } from "@/lib/types";

const theme = EditorView.theme({
  "&": {
    fontSize: "0.95rem",
    backgroundColor: "transparent",
    color: "var(--ink)",
  },
  "&.cm-focused": { outline: "none" },
  ".cm-content": {
    fontFamily: "var(--mono)",
    padding: "14px 0",
    caretColor: "var(--accent)",
    minHeight: "180px",
  },
  ".cm-gutters": {
    backgroundColor: "transparent",
    border: "none",
    color: "var(--ink-faint)",
    fontFamily: "var(--mono)",
  },
  ".cm-activeLine": { backgroundColor: "transparent" },
  ".cm-cursor": { borderLeftColor: "var(--accent)", borderLeftWidth: "2px" },
  ".cm-selectionBackground, &.cm-focused .cm-selectionBackground, ::selection": {
    backgroundColor: "var(--accent-wash)",
  },
  ".cm-tooltip-autocomplete": {
    fontFamily: "var(--mono)",
    fontSize: "0.85rem",
    border: "1px solid var(--line)",
    borderRadius: "10px",
    backgroundColor: "var(--surface)",
    boxShadow: "0 12px 32px rgba(31, 41, 33, 0.16)",
    overflow: "hidden",
  },
  ".cm-tooltip-autocomplete ul li[aria-selected]": {
    backgroundColor: "var(--accent)",
    color: "var(--surface)",
  },
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
          autocompletion({ activateOnTyping: true, maxRenderedOptions: 12 }),
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

  return <div className="sql-editor" ref={host} />;
}
