"use client";

/**
 * Slash command menu (`/`) — the Notion/Potion block inserter. Adapted from
 * Plate's open-source slash-node, trimmed to the blocks this editor supports and
 * wired to our own toggle transforms (no SuggestionPlugin / paid blocks).
 */
import * as React from "react";
import {
  Code2,
  Heading1,
  Heading2,
  Heading3,
  Image as ImageIcon,
  List,
  ListChecks,
  ListOrdered,
  Minus,
  Pilcrow,
  Quote,
  Table as TableIcon,
} from "lucide-react";
import { type TComboboxInputElement, KEYS } from "platejs";
import { type PlateEditor, type PlateElementProps, PlateElement } from "platejs/react";
import { toggleList } from "@platejs/list";
import { insertTable } from "@platejs/table";

import {
  InlineCombobox,
  InlineComboboxContent,
  InlineComboboxEmpty,
  InlineComboboxGroup,
  InlineComboboxGroupLabel,
  InlineComboboxInput,
  InlineComboboxItem,
} from "./inline-combobox";

/** Convert the current (now-empty) block after a slash selection. */
function applyBlock(editor: PlateEditor, value: string) {
  switch (value) {
    case "ul":
      return toggleList(editor, { listStyleType: "disc" });
    case "ol":
      return toggleList(editor, { listStyleType: "decimal" });
    case "todo":
      return toggleList(editor, { listStyleType: "todo" });
    case KEYS.hr:
      editor.tf.insertNodes({ type: KEYS.hr, children: [{ text: "" }] });
      editor.tf.insertNodes(
        { type: KEYS.p, children: [{ text: "" }] },
        { select: true }
      );
      return;
    case KEYS.table:
      insertTable(editor, { colCount: 3, rowCount: 3 }, { select: true });
      return;
    case KEYS.img: {
      const url = window.prompt("Image URL");
      if (url) {
        editor.tf.insertNodes({
          type: KEYS.img,
          url,
          children: [{ text: "" }],
        });
      }
      return;
    }
    default:
      editor.tf.toggleBlock(value);
  }
}

type Item = {
  icon: React.ReactNode;
  label: string;
  value: string;
  keywords?: string[];
};

const groups: { group: string; items: Item[] }[] = [
  {
    group: "Basic blocks",
    items: [
      { icon: <Pilcrow />, label: "Text", value: KEYS.p, keywords: ["paragraph"] },
      { icon: <Heading1 />, label: "Heading 1", value: KEYS.h1, keywords: ["title", "h1"] },
      { icon: <Heading2 />, label: "Heading 2", value: KEYS.h2, keywords: ["subtitle", "h2"] },
      { icon: <Heading3 />, label: "Heading 3", value: KEYS.h3, keywords: ["h3"] },
      { icon: <List />, label: "Bulleted list", value: "ul", keywords: ["unordered", "ul", "-"] },
      { icon: <ListOrdered />, label: "Numbered list", value: "ol", keywords: ["ordered", "ol", "1"] },
      { icon: <ListChecks />, label: "To-do list", value: "todo", keywords: ["checklist", "task", "todo", "[]"] },
      { icon: <Quote />, label: "Quote", value: KEYS.blockquote, keywords: ["blockquote", ">"] },
      { icon: <Code2 />, label: "Code block", value: KEYS.codeBlock, keywords: ["```", "code"] },
      { icon: <Minus />, label: "Divider", value: KEYS.hr, keywords: ["hr", "---", "rule"] },
    ],
  },
  {
    group: "Advanced",
    items: [
      { icon: <TableIcon />, label: "Table", value: KEYS.table, keywords: ["grid"] },
      { icon: <ImageIcon />, label: "Image", value: KEYS.img, keywords: ["picture", "photo"] },
    ],
  },
];

export function SlashInputElement(
  props: PlateElementProps<TComboboxInputElement>
) {
  const { editor, element } = props;
  return (
    <PlateElement {...props} as="span">
      <InlineCombobox element={element} trigger="/">
        <InlineComboboxInput />
        <InlineComboboxContent>
          <InlineComboboxEmpty>No results</InlineComboboxEmpty>
          {groups.map(({ group, items }) => (
            <InlineComboboxGroup key={group}>
              <InlineComboboxGroupLabel>{group}</InlineComboboxGroupLabel>
              {items.map(({ icon, label, value, keywords }) => (
                <InlineComboboxItem
                  key={value}
                  value={value}
                  label={label}
                  group={group}
                  keywords={keywords}
                  onClick={() => applyBlock(editor, value)}
                >
                  <div className="mr-2 text-muted-foreground">{icon}</div>
                  {label}
                </InlineComboboxItem>
              ))}
            </InlineComboboxGroup>
          ))}
        </InlineComboboxContent>
      </InlineCombobox>
      {props.children}
    </PlateElement>
  );
}
