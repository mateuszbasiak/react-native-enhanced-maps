import { Children, Fragment, isValidElement, cloneElement } from 'react';
import type { ElementType, ReactElement, ReactNode } from 'react';
import type { CalloutProps } from './Callout';
type Point = Readonly<{ x: number; y: number }>;
export function extractCallout(children: ReactNode, calloutType: ElementType) {
  let callout: ReactElement<CalloutProps> | undefined;
  let contentCount = 0;
  const visit = (nodes: ReactNode, depth: number): ReactNode => {
    if (depth > 32) throw new Error('Marker child nesting limit exceeded');
    return Children.map(nodes, (node) => {
      if (isValidElement(node) && node.type === Fragment)
        return cloneElement(
          node,
          {},
          visit((node.props as { children?: ReactNode }).children, depth + 1),
        );
      else if (
        isValidElement<CalloutProps>(node) &&
        node.type === calloutType
      ) {
        if (callout) throw new Error('Marker accepts at most one Callout');
        if (
          node.props.tooltip !== undefined &&
          typeof node.props.tooltip !== 'boolean'
        )
          throw new TypeError('Callout tooltip must be a boolean');
        callout = node;
        return null;
      } else if (
        node !== null &&
        node !== undefined &&
        typeof node !== 'boolean'
      ) {
        contentCount++;
        return node;
      }
      return null;
    });
  };
  const content = Children.toArray(visit(children, 0));
  return { content, callout, contentCount };
}
export function calloutText(value: { title?: string; description?: string }) {
  for (const text of [value.title, value.description])
    if (text !== undefined && (typeof text !== 'string' || text.length > 4096))
      throw new TypeError(
        'Callout title and description must be strings of at most 4096 characters',
      );
  return {
    ...(value.title === undefined ? {} : { title: value.title }),
    ...(value.description === undefined
      ? {}
      : { description: value.description }),
  };
}
/** Tip position relative to the geographic pin anchor, in logical points. */
export function calloutOffset(
  size: Readonly<{ width: number; height: number }>,
  pinAnchor: Point,
  pinOffset: Point,
  anchor: Point = { x: 0.5, y: 0 },
  offset: Point = { x: 0, y: 0 },
): Point {
  if (
    ![
      size.width,
      size.height,
      pinAnchor.x,
      pinAnchor.y,
      pinOffset.x,
      pinOffset.y,
      anchor.x,
      anchor.y,
      offset.x,
      offset.y,
    ].every(Number.isFinite) ||
    size.width < 0 ||
    size.height < 0
  )
    throw new RangeError('Callout geometry must be finite');
  return {
    x: size.width * (anchor.x - pinAnchor.x) + pinOffset.x + offset.x,
    y: size.height * (anchor.y - pinAnchor.y) + pinOffset.y + offset.y,
  };
}
