"use client";

import { createContext, useContext, type ReactNode } from "react";
import {
  BaseBoxShapeUtil,
  HTMLContainer,
  T,
  useValue,
  type Editor,
  type TLBaseShape,
  type RecordProps,
} from "tldraw";

/**
 * A `content-tile` is a fixed-box tldraw shape that renders one of our existing
 * content cards (board item / bookmark) by reference. The snapshot only stores
 * geometry + a `refKind`/`refId` pointer; the rich React content is rendered via
 * a renderer supplied through `TileRendererProvider`, so the saved document stays
 * small and content is always read fresh from its source table.
 */
export type ContentTileShape = TLBaseShape<
  "content-tile",
  { w: number; h: number; refKind: string; refId: string }
>;

type TileRenderer = (refKind: string, refId: string) => ReactNode;

const TileRendererContext = createContext<TileRenderer | null>(null);

export function TileRendererProvider({
  render,
  children,
}: {
  render: TileRenderer;
  children: ReactNode;
}) {
  return (
    <TileRendererContext.Provider value={render}>
      {children}
    </TileRendererContext.Provider>
  );
}

// tldraw 5's `TLShape` union doesn't include a custom-shape fallback, so the
// generic constraint on BaseBoxShapeUtil rejects our type at the `extends` site
// unless we register it via module augmentation. We widen the base generic to
// keep the (correct) box behaviors — getGeometry, resizing — and annotate every
// method param explicitly with ContentTileShape so the bodies stay type-safe.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export class ContentTileShapeUtil extends BaseBoxShapeUtil<any> {
  static override type = "content-tile" as const;
  static override props: RecordProps<ContentTileShape> = {
    w: T.number,
    h: T.number,
    refKind: T.string,
    refId: T.string,
  };

  override getDefaultProps(): ContentTileShape["props"] {
    return { w: 320, h: 400, refKind: "card", refId: "" };
  }

  override component(shape: ContentTileShape) {
    return <ContentTileComponent shape={shape} editor={this.editor} />;
  }

  override getIndicatorPath(shape: ContentTileShape) {
    const path = new Path2D();
    path.roundRect(0, 0, shape.props.w, shape.props.h, 8);
    return path;
  }
}

function ContentTileComponent({
  shape,
  editor,
}: {
  shape: ContentTileShape;
  editor: Editor;
}) {
  const render = useContext(TileRendererContext);

  // Pointer events are disabled by default so the tile is draggable/selectable
  // anywhere. When it's the only selected shape, enable interaction so links and
  // buttons inside the tile work — click once to select (and drag), then click
  // again to interact with the content.
  const interactive = useValue(
    "content-tile-interactive",
    () => {
      const selected = editor.getSelectedShapeIds();
      return selected.length === 1 && selected[0] === shape.id;
    },
    [editor, shape.id]
  );

  return (
    <HTMLContainer
      // Links and images are natively draggable; without this, dragging across
      // link text (to select it) starts a native element drag that tldraw's
      // external-content handler turns into a stray bookmark shape. Preventing
      // dragstart also lets normal text selection work inside the tile.
      onDragStart={(e) => e.preventDefault()}
      style={{
        width: shape.props.w,
        height: shape.props.h,
        pointerEvents: interactive ? "all" : "none",
        overflow: "hidden",
        borderRadius: 8,
      }}
    >
      {render ? render(shape.props.refKind, shape.props.refId) : null}
    </HTMLContainer>
  );
}
