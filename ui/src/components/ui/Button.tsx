import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "../../lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-semibold ring-offset-background transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:shadow-md hover:opacity-90 shadow-sm active:scale-95",
        destructive: "border border-red-300 text-destructive hover:bg-red-50 active:scale-95",
        outline: "border border-border text-foreground hover:bg-gray-50 hover:border-primary hover:text-primary active:scale-95",
        secondary: "bg-secondary text-secondary-foreground hover:bg-gray-100 active:scale-95",
        ghost: "text-foreground hover:bg-gray-50 active:scale-95",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-8 px-3 text-xs",
        lg: "h-11 px-6 py-2.5 text-base",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, style, ...props }, ref) => {
    const buttonStyle =
      variant === "default" || variant == null
        ? {
            backgroundColor: "hsl(var(--primary))",
            backgroundImage: "var(--primary-gradient)",
            color: "hsl(var(--primary-foreground))",
            ...style,
          }
        : style

    return (
      <button
        className={cn(buttonVariants({ variant, size }), className)}
        ref={ref}
        style={buttonStyle}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
export default Button
