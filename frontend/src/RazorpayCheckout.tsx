// Razorpay Checkout in a WebView. Loads Razorpay's checkout.js with a backend-created
// order, and posts the payment result (or dismiss/failure) back to React Native.
// Uses react-native-webview (already a dependency) so no native SDK/rebuild is needed.
import React from 'react';
import { Modal, View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { theme } from './theme';

export interface RzpOrder {
  order_id: string;
  key_id: string;
  amount: number; // paise
  currency: string;
}
export interface RzpResult {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

interface Props {
  visible: boolean;
  order: RzpOrder | null;
  name?: string;
  email?: string;
  contact?: string;
  onSuccess: (r: RzpResult) => void;
  onDismiss: () => void;
  onFail?: (msg: string) => void;
}

function buildHtml(order: RzpOrder, name = '', email = '', contact = '') {
  const prefill = JSON.stringify({ name, email, contact });
  return `<!doctype html><html><head>
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1"/>
  <style>html,body{margin:0;height:100%;background:#faf7f0;font-family:-apple-system,Segoe UI,Roboto,sans-serif}
  .l{display:flex;height:100%;align-items:center;justify-content:center;color:#4A5C2F}</style>
  </head><body>
  <div class="l">Opening secure checkout…</div>
  <script src="https://checkout.razorpay.com/v1/checkout.js"></script>
  <script>
    function post(m){ if (window.ReactNativeWebView) { window.ReactNativeWebView.postMessage(JSON.stringify(m)); } }
    function start(){
      if (typeof Razorpay === 'undefined') { post({ event:'failed', description:'Checkout failed to load — check the phone\\'s internet connection.' }); return; }
      var options = {
        key: ${JSON.stringify(order.key_id)},
        order_id: ${JSON.stringify(order.order_id)},
        amount: ${order.amount},
        currency: ${JSON.stringify(order.currency)},
        name: 'RideBuddy',
        description: 'Trip payment',
        prefill: ${prefill},
        theme: { color: '#4A5C2F' },
        handler: function(r){ post({ event:'success', razorpay_order_id:r.razorpay_order_id, razorpay_payment_id:r.razorpay_payment_id, razorpay_signature:r.razorpay_signature }); },
        modal: { ondismiss: function(){ post({ event:'dismiss' }); }, escape: true, backdropclose: false }
      };
      try {
        var rzp = new Razorpay(options);
        rzp.on('payment.failed', function(resp){ post({ event:'failed', description: (resp && resp.error && resp.error.description) || 'Payment failed' }); });
        rzp.open();
      } catch(e){ post({ event:'failed', description: String(e) }); }
    }
    if (document.readyState === 'complete') { start(); } else { window.addEventListener('load', start); }
  </script></body></html>`;
}

export default function RazorpayCheckout({ visible, order, name, email, contact, onSuccess, onDismiss, onFail }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible && !!order} animationType="slide" onRequestClose={onDismiss}>
      <View style={{ flex: 1, backgroundColor: '#faf7f0' }}>
        <View style={[styles.bar, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity onPress={onDismiss} style={styles.close} testID="rzp-close">
            <Ionicons name="close" size={24} color={theme.colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.barTitle}>Secure Payment</Text>
        </View>
        {order && (
          <WebView
            originWhitelist={['*']}
            source={{ html: buildHtml(order, name, email, contact) }}
            javaScriptEnabled
            domStorageEnabled
            startInLoadingState
            renderLoading={() => (
              <View style={styles.loading}><ActivityIndicator color={theme.colors.primary} size="large" /></View>
            )}
            onMessage={(e) => {
              let msg: any = {};
              try { msg = JSON.parse(e.nativeEvent.data); } catch { return; }
              if (msg.event === 'success') onSuccess(msg);
              else if (msg.event === 'dismiss') onDismiss();
              else if (msg.event === 'failed') { if (onFail) onFail(msg.description || 'Payment failed'); else onDismiss(); }
            }}
          />
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, paddingBottom: 10, backgroundColor: theme.colors.card, borderBottomWidth: 1, borderBottomColor: theme.colors.borderLight },
  close: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.softCard },
  barTitle: { fontSize: 17, fontWeight: '900', color: theme.colors.textPrimary },
  loading: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', backgroundColor: '#faf7f0' },
});
