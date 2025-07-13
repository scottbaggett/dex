declare module 'ink' {
  import { FC, ReactNode } from 'react';

  export interface BoxProps {
    children?: ReactNode;
    flexDirection?: 'row' | 'column';
    width?: number | string;
    paddingX?: number;
    paddingY?: number;
    marginX?: number;
    marginY?: number;
    marginTop?: number;
    borderStyle?: 'single' | 'double' | 'round' | 'bold' | 'singleDouble' | 'doubleSingle' | 'classic';
    borderColor?: string;
  }

  export interface TextProps {
    children?: ReactNode;
    color?: string;
    bold?: boolean;
    italic?: boolean;
    underline?: boolean;
    strikethrough?: boolean;
    dimColor?: boolean;
  }

  export const Box: FC<BoxProps>;
  export const Text: FC<TextProps>;

  export interface Key {
    upArrow: boolean;
    downArrow: boolean;
    leftArrow: boolean;
    rightArrow: boolean;
    return: boolean;
    escape: boolean;
    tab: boolean;
    shift: boolean;
    ctrl: boolean;
    alt: boolean;
    meta: boolean;
  }

  export function useInput(handler: (input: string, key: Key) => void): void;

  export interface App {
    exit: (error?: Error) => void;
    unmount: () => void;
    waitUntilExit: () => Promise<void>;
    clear: () => void;
  }

  export function useApp(): { exit: (error?: Error) => void };

  export function render(element: ReactNode): App;
}