// src/components/Home.tsx
import { useWallet } from '@txnlab/use-wallet-react'
import React, { useState } from 'react'
import ConnectWallet from './components/ConnectWallet'
import FoodSafety from './components/FoodSafety'
import { Role, ROLES } from './types/roles'

interface HomeProps {}

const Home: React.FC<HomeProps> = () => {
  const [openWalletModal, setOpenWalletModal] = useState<boolean>(false)
  const [selectedRole, setSelectedRole] = useState<Role | null>(null)
  const [foodSafetyModal, setFoodSafetyModal] = useState<boolean>(false)
  const { activeAddress } = useWallet()

  const toggleWalletModal = () => {
    setOpenWalletModal(!openWalletModal)
  }

  const handleRoleSelect = (role: Role) => {
    setSelectedRole(role)
  }

  const openFoodSafety = () => {
    if (selectedRole) {
      setFoodSafetyModal(true)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-tr from-teal-400 via-cyan-300 to-sky-400 relative">
      {/* Top-right wallet connect button - responsive */}
      <div className="absolute top-2 right-2 sm:top-4 sm:right-4 z-10">
        <button
          data-test-id="connect-wallet"
          className="btn btn-accent btn-sm sm:btn-md px-3 sm:px-5 py-1 sm:py-2 text-xs sm:text-sm font-medium rounded-full shadow-md"
          onClick={toggleWalletModal}
        >
          {activeAddress ? 'Connected' : 'Connect'}
        </button>
      </div>

      {/* Centered content - responsive padding and sizing */}
      <div className="flex items-center justify-center min-h-screen px-2 sm:px-4 py-16 sm:py-4">
        <div className="backdrop-blur-md bg-white/70 rounded-2xl p-4 sm:p-8 shadow-xl max-w-5xl w-full">
          <h1 className="text-2xl sm:text-4xl font-extrabold text-teal-700 mb-3 sm:mb-6 text-center">
            AgriTrust
          </h1>
          <p className="text-sm sm:text-base text-gray-700 mb-4 sm:mb-8 text-center">
            Food Safety & Traceability on Algorand
          </p>

          {activeAddress ? (
            <>
              <div className="alert alert-info mb-4">
                <div>
                  <span className="font-semibold">Connected Account:</span>
                  <br />
                  <span className="text-xs font-mono">{activeAddress}</span>
                </div>
              </div>

              {!selectedRole ? (
                <div className="grid grid-cols-1 gap-4 sm:gap-6">
                  <div className="card bg-gradient-to-br from-green-600 to-emerald-600 text-white shadow-xl">
                    <div className="card-body p-4 sm:p-6">
                      <h2 className="card-title text-lg sm:text-xl">Select Your Role</h2>
                      <p className="text-sm sm:text-base">
                        Choose your role in the supply chain to access relevant actions.
                      </p>
                      <div className="grid grid-cols-2 gap-2 mt-4">
                        {Object.entries(ROLES).map(([key, label]) => (
                          <button
                            key={key}
                            className="btn btn-outline btn-sm sm:btn-md"
                            onClick={() => handleRoleSelect(key as Role)}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 sm:gap-6">
                  <div className="card bg-gradient-to-br from-blue-600 to-cyan-600 text-white shadow-xl">
                    <div className="card-body p-4 sm:p-6">
                      <h2 className="card-title text-lg sm:text-xl">Role: {ROLES[selectedRole]}</h2>
                      <p className="text-sm sm:text-base">
                        Access your role-specific actions in the food safety system.
                      </p>
                      <div className="card-actions justify-end mt-2">
                        <button
                          className="btn btn-outline btn-sm sm:btn-md"
                          onClick={() => openFoodSafety()}
                        >
                          Open Dashboard
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:gap-6">
              <div className="card bg-gradient-to-br from-green-600 to-emerald-600 text-white shadow-xl">
                <div className="card-body p-4 sm:p-6">
                  <h2 className="card-title text-lg sm:text-xl">Food Safety System</h2>
                  <p className="text-sm sm:text-base">
                    Create batches, inspect, distribute, and recall food products with blockchain traceability.
                  </p>
                  <div className="card-actions justify-end mt-2">
                    <p className="text-sm">Connect your wallet to get started.</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <ConnectWallet openModal={openWalletModal} closeModal={toggleWalletModal} />
      <FoodSafety openModal={foodSafetyModal} closeModal={() => setFoodSafetyModal(false)} role={selectedRole} />
    </div>
  )
}

export default Home
