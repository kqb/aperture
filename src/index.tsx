import { getChainOptions, WalletProvider } from '@terra-money/wallet-provider';
import { Anchor } from 'components/Anchor';
import React from 'react';
import ReactDOM from 'react-dom';
import './style.css';

function App() {
  return (
    <main
      style={{ margin: 20, display: 'flex', flexDirection: 'column', gap: 40 }}
    >
      <Anchor />
    </main>
  );
}

getChainOptions().then((chainOptions) => {
  ReactDOM.render(
    <WalletProvider {...chainOptions}>
      <App />
    </WalletProvider>,
    document.getElementById('root'),
  );
});
