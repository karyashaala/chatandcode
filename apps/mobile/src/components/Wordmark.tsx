import type { ColorValue } from "react-native";
import Svg, { Path } from "react-native-svg";
import { withUniwind } from "uniwind";

const ThemedPath = withUniwind(Path);

/**
 * The ChatAndCode brand mark, matching the web T3Wordmark SVG
 * (apps/web/src/components/T3Wordmark.tsx). The mark is square.
 */
export function Wordmark(props: {
  readonly height: number;
  readonly color?: ColorValue;
  readonly colorClassName?: string;
}) {
  const aspectRatio = 1;
  return (
    <Svg
      accessibilityLabel="ChatAndCode"
      height={props.height}
      width={props.height * aspectRatio}
      viewBox="20 17 94 94"
    >
      <ThemedPath
        d="M103.004 33.789A47 47 0 1 0 103.004 94.211L92.279 85.212A33 33 0 1 1 92.279 42.788ZM85.385 48.573A24 24 0 1 0 85.385 79.427L76.192 71.713A12 12 0 1 1 76.192 56.287Z"
        color={props.color}
        colorClassName={props.colorClassName}
        fill="currentColor"
      />
    </Svg>
  );
}
