/**
 * The design-system public API.
 *
 * `ui/` is a layer, not a bounded context, so this barrel is a convenience
 * rather than an access-control boundary — importing a module directly is still
 * fine and is what the older screens do. New code should import from here so
 * that moving a primitive between files is not a screen-wide edit.
 *
 * Nothing in `ui/` may import `features/` or `app/`; see docs/ARCHITECTURE.md.
 */
export { cn, focusRing, touchTarget, type ClassValue } from "./cn";
export {
  Badge,
  Card,
  DataText,
  EdgeGlow,
  EmptyState,
  FactPair,
  GhostButton,
  IconButton,
  LabelCaps,
  PrimaryButton,
  SectionHeader,
  StatusChip,
  ToggleChip,
  type IconComponent,
} from "./primitives";
export { Skeleton, SkeletonCard, SkeletonList, SkeletonText, type SkeletonProps } from "./Skeleton";
export { ErrorState, type ErrorStateProps } from "./ErrorState";
export { AsyncBoundary, type AsyncBoundaryProps } from "./AsyncBoundary";
export { LiveRegion } from "./LiveRegion";
export { useFocusTrap } from "./useFocusTrap";
export { VehicleFactGrid } from "./VehicleFactGrid";
export { ErrorBoundary } from "./ErrorBoundary";
