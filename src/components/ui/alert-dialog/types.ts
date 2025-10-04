import * as React from "react";

export type AsChildProps = { asChild?: boolean };
export type WithClass<T> = T & { className?: string };

export type OverlayProps = React.ComponentPropsWithoutRef<"div">;
export type ContentProps = React.ComponentPropsWithoutRef<"div">;
export type TitleProps = React.ComponentPropsWithoutRef<"h2">;
export type DescriptionProps = React.ComponentPropsWithoutRef<"p">;
export type ActionProps = React.ComponentPropsWithoutRef<"button"> & AsChildProps;
export type CancelProps = React.ComponentPropsWithoutRef<"button"> & AsChildProps;
