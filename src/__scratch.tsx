import * as React from "react";
import type { ErrorRouteComponent, ErrorComponentProps } from "@tanstack/react-router";

const P = () => <div>x</div>;

// V1: plain arrow, contextual
export const v1: ErrorRouteComponent = () => <div>x</div>;

// V2: named function with explicit props, contextual
export const v2: ErrorRouteComponent = ({ error, reset }: { error: Error; reset: () => void }) => <div>{String(error)}{reset()}</div>;

// V3: typed with ErrorComponentProps
export const v3: ErrorRouteComponent = (props: ErrorComponentProps) => <div>{String(props.error)}{props.reset()}</div>;

// V4: lazy
export const v4: ErrorRouteComponent = React.lazy(async () => ({ default: P }));
