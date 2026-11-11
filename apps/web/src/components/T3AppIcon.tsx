// The production icon, as GitHub shows the ChatAndCode app, whatever this build's channel.
import appIconUrl from "../../../../assets/prod/chatandcode-black-web-apple-touch-180.png";

export function T3AppIcon(props: { readonly className?: string }) {
  return <img src={appIconUrl} alt="" className={props.className} />;
}
