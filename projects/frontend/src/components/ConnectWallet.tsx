import { useWallet, Wallet, WalletId } from '@txnlab/use-wallet-react'
import Account from './Account'

interface ConnectWalletInterface {
  openModal: boolean
  closeModal: () => void
}

const ConnectWallet = ({ openModal, closeModal }: ConnectWalletInterface) => {
  const { wallets, activeAddress } = useWallet()

  const isPera = (wallet: Wallet) => wallet.id === WalletId.PERA

  const getWalletDisplayName = (wallet: Wallet) => {
    if (isPera(wallet)) return 'Pera Wallet'
    return wallet.metadata.name
  }

  const getWalletDescription = (wallet: Wallet) => {
    if (isPera(wallet)) return 'Mobile and web wallet'
    return ''
  }

  return (
    <dialog id="connect_wallet_modal" className={`modal ${openModal ? 'modal-open' : ''}`}>
      <form method="dialog" className="modal-box">
        <h3 className="font-bold text-2xl">Select wallet provider</h3>

        <div className="grid m-2 pt-5">
          {activeAddress && (
            <>
              <Account />
              <div className="divider" />
            </>
          )}

          {!activeAddress &&
            wallets?.map((wallet) => (
              <button
                data-test-id={`${wallet.id}-connect`}
                className="btn border-teal-800 border-1 m-2 h-auto py-4 flex flex-col items-start justify-start"
                key={`provider-${wallet.id}`}
                onClick={() => {
                  return wallet.connect()
                }}
              >
                <div className="flex items-center gap-3 w-full">
                  <img
                    alt={`wallet_icon_${wallet.id}`}
                    src={wallet.metadata.icon}
                    style={{ objectFit: 'contain', width: '30px', height: '30px' }}
                  />
                  <div className="flex flex-col items-start">
                    <span className="font-semibold">{getWalletDisplayName(wallet)}</span>
                    {getWalletDescription(wallet) && (
                      <span className="text-xs opacity-70 font-normal">{getWalletDescription(wallet)}</span>
                    )}
                  </div>
                </div>
              </button>
            ))}
        </div>

        <div className="modal-action ">
          <button
            data-test-id="close-wallet-modal"
            className="btn"
            onClick={() => {
              closeModal()
            }}
          >
            Close
          </button>
          {activeAddress && (
            <button
              className="btn btn-warning"
              data-test-id="logout"
              onClick={async () => {
                if (wallets) {
                  const activeWallet = wallets.find((w) => w.isActive)
                  if (activeWallet) {
                    await activeWallet.disconnect()
                  } else {
                    localStorage.removeItem('@txnlab/use-wallet:v3')
                    window.location.reload()
                  }
                }
              }}
            >
              Logout
            </button>
          )}
        </div>
      </form>
    </dialog>
  )
}
export default ConnectWallet
