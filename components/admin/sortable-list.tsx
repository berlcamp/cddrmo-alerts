'use client';

import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent, type Modifier } from '@dnd-kit/core';
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';
import { useId, useState, useTransition, type ReactNode } from 'react';
import { toast } from 'sonner';
import type { ActionResult } from '@/lib/action-result';
import { cn } from '@/lib/utils';

const restrictToVerticalAxis: Modifier = ({ transform }) => ({ ...transform, x: 0 });

const INSTRUCTIONS = 'To reorder, press Space or Enter on the handle, use the arrow keys to move, then press Space or Enter again to drop. Press Escape to cancel.';

type Row = { id: string; label: string };

function SortableRow({ row, sortable, className, children }: { row: Row; sortable: boolean; className?: string; children: ReactNode }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: row.id, disabled: !sortable });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn('relative flex items-center gap-2 bg-card px-2 py-2.5 sm:gap-3 sm:px-3', className, isDragging && 'z-10 rounded-lg shadow-lg ring-2 ring-primary/40')}
    >
      {sortable && (
        <button
          type="button"
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          aria-label={`Reorder ${row.label}`}
          className="flex size-11 shrink-0 cursor-grab touch-none items-center justify-center rounded-md text-muted-foreground transition-colors duration-150 hover:bg-accent hover:text-foreground active:cursor-grabbing"
        >
          <GripVertical className="size-5" aria-hidden />
        </button>
      )}
      {children}
    </li>
  );
}

/**
 * A card list whose rows reorder by dragging a handle (mouse, touch or keyboard). The new order shows at once,
 * is saved with `onReorder`, and is rolled back if that fails. A fresh `items` list from the server wins.
 */
export function SortableList<T extends Row>({ items, onReorder, sortable = true, visible, rowClassName, children }: {
  items: T[];
  onReorder: (orderedIds: string[]) => Promise<ActionResult>;
  sortable?: boolean;
  visible?: (item: T) => boolean;
  rowClassName?: (item: T) => string | false | undefined;
  children: (item: T, position: number) => ReactNode;
}) {
  const id = useId();
  const serverOrder = items.map((item) => item.id).join(',');
  const [order, setOrder] = useState({ server: serverOrder, ids: items.map((item) => item.id) });
  if (order.server !== serverOrder) setOrder({ server: serverOrder, ids: items.map((item) => item.id) });
  const [, startTransition] = useTransition();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const byId = new Map(items.map((item) => [item.id, item]));
  const ordered = order.ids.map((itemId) => byId.get(itemId)).filter((item): item is T => item !== undefined);
  const shown = sortable || !visible ? ordered : ordered.filter(visible);

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const previous = order;
    const ids = arrayMove(order.ids, order.ids.indexOf(String(active.id)), order.ids.indexOf(String(over.id)));
    setOrder({ server: previous.server, ids });
    startTransition(async () => {
      try {
        const result = await onReorder(ids);
        if (!result.ok) {
          setOrder(previous);
          toast.error(result.message);
        }
      } catch {
        setOrder(previous);
        toast.error("Couldn't save the new order. Check your connection and try again.");
      }
    });
  };

  const list = (
    <ul className="divide-y rounded-xl border bg-card">
      {shown.map((item) => (
        <SortableRow key={item.id} row={item} sortable={sortable} className={rowClassName?.(item) || undefined}>
          {children(item, ordered.indexOf(item) + 1)}
        </SortableRow>
      ))}
    </ul>
  );
  if (!sortable) return list;
  return (
    <DndContext
      id={id}
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[restrictToVerticalAxis]}
      onDragEnd={onDragEnd}
      accessibility={{ screenReaderInstructions: { draggable: INSTRUCTIONS } }}
    >
      <SortableContext items={order.ids} strategy={verticalListSortingStrategy}>{list}</SortableContext>
    </DndContext>
  );
}
