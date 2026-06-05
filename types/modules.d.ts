declare module 'react-native-webview' {
  import { Component } from 'react';
  import { ViewStyle } from 'react-native';

  export interface WebViewProps {
    source?: { html?: string; uri?: string };
    style?: ViewStyle | ViewStyle[];
    javaScriptEnabled?: boolean;
    originWhitelist?: string[];
    onLoadEnd?: () => void;
    onMessage?: (event: { nativeEvent: { data: string } }) => void;
    ref?: React.Ref<any>;
  }

  export class WebView extends Component<WebViewProps> {
    postMessage(data: string): void;
  }

  export default WebView;
}
