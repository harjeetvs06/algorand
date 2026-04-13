import { SupportedWallet, WalletId, WalletManager, WalletProvider } from '@txnlab/use-wallet-react'
import { SnackbarProvider } from 'notistack'
import { PeraWalletConnect } from '@perawallet/connect'
import Home from './Home'
import { getAlgodConfigFromViteEnvironment } from './utils/network/getAlgoClientConfigs'

const supportedWallets: SupportedWallet[] = [
  {
    id: WalletId.PERA,
    options: {
      clientStatic: PeraWalletConnect,
    },
  },
]

export default function App() {
  const algodConfig = getAlgodConfigFromViteEnvironment()

  const walletManager = new WalletManager({
    wallets: supportedWallets,
    defaultNetwork: algodConfig.network,
    networks: {
      [algodConfig.network]: {
        algod: {
          baseServer: algodConfig.server,
          port: algodConfig.port,
          token: String(algodConfig.token),
        },
      },
    },
    options: {
      resetNetwork: true,
    },
  })

  return (
    <SnackbarProvider maxSnack={3}>
      <WalletProvider manager={walletManager}>
        <Home />
      </WalletProvider>
    </SnackbarProvider>
  )
}
