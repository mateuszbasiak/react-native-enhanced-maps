import type { AccessibilityProps } from 'react-native';

export type MarkerAccessibilityProps = Pick<
  AccessibilityProps,
  | 'accessible'
  | 'accessibilityLabel'
  | 'accessibilityHint'
  | 'accessibilityRole'
  | 'accessibilityState'
  | 'accessibilityActions'
  | 'onAccessibilityAction'
>;

/** Put marker semantics on one target without grouping custom controls by default. */
export function markerAccessibility(
  props: MarkerAccessibilityProps & {
    readonly onPress?: unknown;
    readonly onSelect?: unknown;
    readonly title?: string;
    readonly identifier?: string;
  },
  context: {
    readonly hasCustomContent: boolean;
    readonly hasCallout: boolean;
    readonly selected: boolean;
    readonly id: string;
  },
): { wrapper: AccessibilityProps; content: AccessibilityProps } {
  const interactive = !!(props.onPress || props.onSelect || context.hasCallout);
  const accessible =
    props.accessible ??
    (!!props.accessibilityLabel || !context.hasCustomContent);
  const target: AccessibilityProps = {
    accessible,
    accessibilityLabel:
      props.accessibilityLabel ??
      props.title ??
      props.identifier ??
      (interactive ? context.id : 'Map marker'),
    accessibilityHint: props.accessibilityHint,
    accessibilityRole:
      props.accessibilityRole ?? (interactive ? 'button' : undefined),
    accessibilityState: context.hasCallout
      ? { ...props.accessibilityState, expanded: context.selected }
      : props.accessibilityState,
    accessibilityActions: props.accessibilityActions,
    onAccessibilityAction: props.onAccessibilityAction,
  };
  return interactive
    ? { wrapper: { accessible: false }, content: target }
    : { wrapper: target, content: { accessible: false } };
}
