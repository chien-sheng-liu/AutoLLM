import React from "react";
import { cn } from "@/app/components/ui/utils";

export type ContainerProps = React.HTMLAttributes<HTMLDivElement> & {
  width?: 'xl'|'2xl'|'lg';
};

export default function Container({ className, width = '2xl', ...props }: ContainerProps) {
  const max = width === 'xl' ? 'max-w-screen-xl' : width === 'lg' ? 'max-w-screen-lg' : 'max-w-screen-2xl';
  return <div className={cn("mx-auto px-6 md:px-10", max, className)} {...props} />;
}

