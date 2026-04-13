import { useEffect, useMemo, useState } from 'react'
import { useWallet } from '@txnlab/use-wallet-react'
import { useSnackbar } from 'notistack'
import { AlgorandClient } from '@algorandfoundation/algokit-utils'
import { FoodSafetyAppClient, FoodSafetyAppFactory } from '../contracts/FoodSafetyApp'
import algosdk from 'algosdk'
import { getAlgodConfigFromViteEnvironment, getIndexerConfigFromViteEnvironment } from '../utils/network/getAlgoClientConfigs'
import { pinJSONToIPFS, pinFileToIPFS } from '../utils/pinata'
import { Role, ROLES, ROLE_ACTIONS } from '../types/roles'

interface FoodSafetyProps {
  openModal: boolean
  closeModal: () => void
  role: Role | null
}

type BatchStatus = 'CREATED' | 'APPROVED' | 'REJECTED' | 'DISTRIBUTED' | 'RECALLED'

interface BatchInfo {
  batchId: string
  producer: string
  productName: string
  originLocation: string
  harvestDate: bigint
  status: BatchStatus
  ipfsHash: string
  inspectionReportHash: string
}

const STATUS_MAP: Record<number, BatchStatus> = {
  0: 'CREATED',
  2: 'APPROVED',
  3: 'REJECTED',
  4: 'DISTRIBUTED',
  5: 'RECALLED',
}

const FoodSafety = ({ openModal, closeModal, role }: FoodSafetyProps) => {
  const { enqueueSnackbar } = useSnackbar()
  const { activeAddress, transactionSigner } = useWallet()
  const algodConfig = getAlgodConfigFromViteEnvironment()
  const indexerConfig = getIndexerConfigFromViteEnvironment()
  const algorand = useMemo(() => AlgorandClient.fromConfig({ algodConfig, indexerConfig }), [algodConfig, indexerConfig])
  
  const [appId, setAppId] = useState<number | ''>(0)
  const [deploying, setDeploying] = useState<boolean>(false)
  const [loading, setLoading] = useState<boolean>(false)
  
  // Create batch form
  const [batchId, setBatchId] = useState<string>('')
  const [productName, setProductName] = useState<string>('')
  const [originLocation, setOriginLocation] = useState<string>('')
  const [harvestDate, setHarvestDate] = useState<string>('')
  const [ipfsFile, setIpfsFile] = useState<File | null>(null)
  
  // Inspect batch form
  const [inspectBatchId, setInspectBatchId] = useState<string>('')
  const [inspectionApproved, setInspectionApproved] = useState<boolean>(true)
  const [inspectionFile, setInspectionFile] = useState<File | null>(null)
  
  // Distribute batch form
  const [distributeBatchId, setDistributeBatchId] = useState<string>('')
  
  // Recall batch form
  const [recallBatchId, setRecallBatchId] = useState<string>('')
  const [recallReason, setRecallReason] = useState<string>('')
  
  // View batch form
  const [viewBatchId, setViewBatchId] = useState<string>('')
  const [batchInfo, setBatchInfo] = useState<BatchInfo | null>(null)
  const allowedActions = role ? ROLE_ACTIONS[role] : []

  const canPerformAction = (action: string) => allowedActions.includes(action)

  const deployContract = async () => {
    if (role !== 'supplier') throw new Error('Only suppliers can deploy contracts')
    try {
      if (!activeAddress || !transactionSigner) throw new Error('Connect Pera Wallet')
      setDeploying(true)
      const factory = new FoodSafetyAppFactory({
        defaultSender: activeAddress,
        defaultSigner: transactionSigner,
        algorand,
      })
      const result = await factory.send.create.bare({
        sender: activeAddress,
        signer: transactionSigner,
      })
      const newId = Number(result.appClient.appId)
      setAppId(newId)
      enqueueSnackbar(`FoodSafety deployed. App ID: ${newId}`, { variant: 'success' })
    } catch (e) {
      enqueueSnackbar(`Deploy failed: ${(e as Error).message}`, { variant: 'error' })
    } finally {
      setDeploying(false)
    }
  }



  const createBatch = async () => {
    if (role !== 'supplier') throw new Error('Only suppliers can create batches')
    let ipfsHash = ''
    let harvestTimestamp = 0
    
    try {
      if (!activeAddress || !transactionSigner) throw new Error('Connect wallet')
      if (!appId || appId <= 0) throw new Error('Enter valid App ID')
      if (!batchId || !productName || !originLocation || !harvestDate) {
        throw new Error('Fill all required fields')
      }
      
      setLoading(true)
      
      console.log('Creating batch with account:', activeAddress)
      
      // Upload file to IPFS if provided
      if (ipfsFile) {
        const result = await pinFileToIPFS(ipfsFile)
        ipfsHash = result.IpfsHash
      }
      
      harvestTimestamp = Math.floor(new Date(harvestDate).getTime() / 1000)
      
      // Set the signer
      algorand.setDefaultSigner(transactionSigner)
      
      // Get app address using algosdk (NOT the creator address!)
      const appAddress = algosdk.getApplicationAddress(Number(appId))
      
      // Calculate box MBR: 2500 (base) + 400 * box_size
      // BatchRecord is ~500 bytes, so ~202,500 microALGO
      const boxMBR = 300000 // 0.3 ALGO to be safe
      
      console.log('Sending MBR payment to app address:', appAddress)
      
      // Send MBR payment from connected wallet to app address
      await algorand.send.payment({
        sender: activeAddress,
        receiver: appAddress,
        amount: { microAlgo: boxMBR },
        signer: transactionSigner,
      })
      
      console.log('MBR payment sent, now creating batch...')
      
      // Create client
      const client = new FoodSafetyAppClient({
        appId: BigInt(appId),
        sender: activeAddress,
        algorand,
      })
      
      // Call createBatch - MBR is already paid
      await client.send.createBatch({
        args: {
          batchId,
          producerAddress: activeAddress,
          productName,
          originLocation,
          harvestDate: BigInt(harvestTimestamp),
          ipfsHash: ipfsHash || '',
        },
        sender: activeAddress,
        signer: transactionSigner,
      })
      
      enqueueSnackbar(`Batch ${batchId} created successfully!`, { variant: 'success' })
      setBatchId('')
      setProductName('')
      setOriginLocation('')
      setHarvestDate('')
      setIpfsFile(null)
    } catch (e) {
      const errorMsg = (e as Error).message
      console.error('Create batch error:', errorMsg)
      console.error('Expected account:', activeAddress)
      enqueueSnackbar(`Create batch failed: ${errorMsg}`, { variant: 'error' })
    } finally {
      setLoading(false)
    }
  }

  const inspectBatch = async () => {
    if (role !== 'approver') throw new Error('Only approvers can inspect batches')
    try {
      if (!activeAddress || !transactionSigner) throw new Error('Connect wallet')
      if (!appId || appId <= 0) throw new Error('Enter valid App ID')
      if (!inspectBatchId) throw new Error('Enter batch ID')
      
      setLoading(true)
      
      // Upload inspection report to IPFS if provided
      let inspectionHash = ''
      if (inspectionFile) {
        const result = await pinFileToIPFS(inspectionFile)
        inspectionHash = result.IpfsHash
      } else {
        // Create a simple JSON report
        const report = {
          approved: inspectionApproved,
          timestamp: new Date().toISOString(),
          inspector: activeAddress,
        }
        const result = await pinJSONToIPFS(report)
        inspectionHash = result.IpfsHash
      }
      
      const client = new FoodSafetyAppClient({
        appId: BigInt(appId),
        algorand,
        defaultSigner: transactionSigner,
      })
      
      await client.send.inspectBatch({
        args: {
          batchId: inspectBatchId,
          inspectionReportHash: inspectionHash,
          approved: BigInt(inspectionApproved ? 1 : 0),
        },
        sender: activeAddress,
      })
      
      enqueueSnackbar(`Batch ${inspectBatchId} inspected successfully`, { variant: 'success' })
      setInspectBatchId('')
      setInspectionFile(null)
    } catch (e) {
      enqueueSnackbar(`Inspect batch failed: ${(e as Error).message}`, { variant: 'error' })
    } finally {
      setLoading(false)
    }
  }

  const distributeBatch = async () => {
    if (role !== 'distributor') throw new Error('Only distributors can distribute batches')
    try {
      if (!activeAddress || !transactionSigner) throw new Error('Connect wallet')
      if (!appId || appId <= 0) throw new Error('Enter valid App ID')
      if (!distributeBatchId) throw new Error('Enter batch ID')
      
      setLoading(true)
      
      const client = new FoodSafetyAppClient({
        appId: BigInt(appId),
        algorand,
        defaultSigner: transactionSigner,
      })
      
      await client.send.distributeBatch({
        args: { batchId: distributeBatchId },
        sender: activeAddress,
      })
      
      enqueueSnackbar(`Batch ${distributeBatchId} distributed successfully`, { variant: 'success' })
      setDistributeBatchId('')
    } catch (e) {
      enqueueSnackbar(`Distribute batch failed: ${(e as Error).message}`, { variant: 'error' })
    } finally {
      setLoading(false)
    }
  }

  const recallBatch = async () => {
    if (role !== 'retailer') throw new Error('Only retailers can recall batches')
    try {
      if (!activeAddress || !transactionSigner) throw new Error('Connect wallet')
      if (!appId || appId <= 0) throw new Error('Enter valid App ID')
      if (!recallBatchId || !recallReason) throw new Error('Fill all fields')
      
      setLoading(true)
      
      // Upload recall reason to IPFS
      const recallData = {
        reason: recallReason,
        timestamp: new Date().toISOString(),
        recalledBy: activeAddress,
      }
      const result = await pinJSONToIPFS(recallData)
      
      const client = new FoodSafetyAppClient({
        appId: BigInt(appId),
        algorand,
        defaultSigner: transactionSigner,
      })
      
      await client.send.recallBatch({
        args: {
          batchId: recallBatchId,
          reasonHash: result.IpfsHash,
        },
        sender: activeAddress,
      })
      
      enqueueSnackbar(`Batch ${recallBatchId} recalled successfully`, { variant: 'success' })
      setRecallBatchId('')
      setRecallReason('')
    } catch (e) {
      enqueueSnackbar(`Recall batch failed: ${(e as Error).message}`, { variant: 'error' })
    } finally {
      setLoading(false)
    }
  }

  const viewBatch = async () => {
    try {
      if (!appId || appId <= 0) throw new Error('Enter valid App ID')
      if (!viewBatchId) throw new Error('Enter batch ID')
      
      setLoading(true)
      
      const client = new FoodSafetyAppClient({
        appId: BigInt(appId),
        algorand,
        defaultSigner: transactionSigner,
      })
      
      const result = await client.getBatch({ args: { batchId: viewBatchId } })
      
      // getBatch returns a tuple: [batchId, producer, productName, originLocation, harvestDate, status, ipfsHash, inspectionReportHash]
      const [retBatchId, producer, productName, originLocation, harvestDate, status, ipfsHash, inspectionReportHash] = result
      
      setBatchInfo({
        batchId: retBatchId,
        producer,
        productName,
        originLocation,
        harvestDate: BigInt(harvestDate),
        status: STATUS_MAP[Number(status)] || 'CREATED',
        ipfsHash,
        inspectionReportHash,
      })
      
      enqueueSnackbar(`Batch ${viewBatchId} retrieved successfully`, { variant: 'success' })
    } catch (e) {
      enqueueSnackbar(`View batch failed: ${(e as Error).message}`, { variant: 'error' })
      setBatchInfo(null)
    } finally {
      setLoading(false)
    }
  }


  return (
    <dialog id="foodsafety_modal" className={`modal ${openModal ? 'modal-open' : ''} bg-slate-200`}>
      <form method="dialog" className="modal-box max-w-5xl max-h-[90vh] overflow-y-auto">
        <h3 className="font-bold text-lg mb-4">AgriTrust - Food Safety & Traceability {role && `(${ROLES[role]})`}</h3>
        
        {/* Display connected account */}
        {activeAddress && (
          <div className="alert alert-info mb-4">
            <div>
              <span className="font-semibold">Connected Account:</span>
              <br />
              <span className="text-xs font-mono">{activeAddress}</span>
            </div>
          </div>
        )}
        
        <div className="flex flex-col gap-4">
          {/* Deploy Section */}
          {role === 'supplier' && (
            <div className="card bg-base-200">
              <div className="card-body">
                <h4 className="card-title">Deploy Contract</h4>
                <div className="flex gap-2">
                  <input
                    className="input input-bordered flex-1"
                    type="number"
                    value={appId}
                    onChange={(e) => setAppId(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="Enter deployed App ID"
                  />
                  <button
                    className={`btn btn-primary ${deploying ? 'loading' : ''}`}
                    disabled={deploying || !activeAddress || !transactionSigner}
                    onClick={(e) => {
                      e.preventDefault()
                      void deployContract()
                    }}
                  >
                    Deploy
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Create Batch */}
          {canPerformAction('create_batch') && (
            <div className="card bg-base-200">
              <div className="card-body">
                <h4 className="card-title">Create Batch (Supplier)</h4>
                <div className="grid grid-cols-2 gap-2">
                  <input className="input input-bordered" placeholder="Batch ID" value={batchId} onChange={(e) => setBatchId(e.target.value)} />
                  <input className="input input-bordered" placeholder="Product Name" value={productName} onChange={(e) => setProductName(e.target.value)} />
                  <input className="input input-bordered" placeholder="Origin Location" value={originLocation} onChange={(e) => setOriginLocation(e.target.value)} />
                  <input className="input input-bordered" type="date" placeholder="Harvest Date" value={harvestDate} onChange={(e) => setHarvestDate(e.target.value)} />
                  <input className="input input-bordered col-span-2" type="file" onChange={(e) => setIpfsFile(e.target.files?.[0] || null)} />
                  <button
                    className={`btn btn-success col-span-2 ${loading ? 'loading' : ''}`}
                    disabled={loading || !activeAddress || !appId}
                    onClick={(e) => {
                      e.preventDefault()
                      void createBatch()
                    }}
                  >
                    Create Batch
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Inspect Batch */}
          {canPerformAction('inspect_batch') && (
            <div className="card bg-base-200">
              <div className="card-body">
                <h4 className="card-title">Inspect Batch (Approver)</h4>
                <div className="flex flex-col gap-2">
                  <input className="input input-bordered" placeholder="Batch ID" value={inspectBatchId} onChange={(e) => setInspectBatchId(e.target.value)} />
                  <div className="form-control">
                    <label className="label cursor-pointer">
                      <span className="label-text">Approved</span>
                      <input type="checkbox" className="toggle" checked={inspectionApproved} onChange={(e) => setInspectionApproved(e.target.checked)} />
                    </label>
                  </div>
                  <input className="input input-bordered" type="file" onChange={(e) => setInspectionFile(e.target.files?.[0] || null)} />
                  <button
                    className={`btn btn-warning ${loading ? 'loading' : ''}`}
                    disabled={loading || !activeAddress || !appId}
                    onClick={(e) => {
                      e.preventDefault()
                      void inspectBatch()
                    }}
                  >
                    Inspect Batch
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Distribute Batch */}
          {canPerformAction('distribute_batch') && (
            <div className="card bg-base-200">
              <div className="card-body">
                <h4 className="card-title">Distribute Batch (Distributor)</h4>
                <div className="flex gap-2">
                  <input className="input input-bordered flex-1" placeholder="Batch ID" value={distributeBatchId} onChange={(e) => setDistributeBatchId(e.target.value)} />
                  <button
                    className={`btn btn-info ${loading ? 'loading' : ''}`}
                    disabled={loading || !activeAddress || !appId}
                    onClick={(e) => {
                      e.preventDefault()
                      void distributeBatch()
                    }}
                  >
                    Distribute
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Recall Batch */}
          {canPerformAction('recall_batch') && (
            <div className="card bg-base-200">
              <div className="card-body">
                <h4 className="card-title">Recall Batch (Retailer)</h4>
                <div className="flex flex-col gap-2">
                  <input className="input input-bordered" placeholder="Batch ID" value={recallBatchId} onChange={(e) => setRecallBatchId(e.target.value)} />
                  <textarea className="textarea textarea-bordered" placeholder="Recall Reason" value={recallReason} onChange={(e) => setRecallReason(e.target.value)} />
                  <button
                    className={`btn btn-error ${loading ? 'loading' : ''}`}
                    disabled={loading || !activeAddress || !appId}
                    onClick={(e) => {
                      e.preventDefault()
                      void recallBatch()
                    }}
                  >
                    Recall Batch
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* View Batch */}
          {canPerformAction('view_batch') && (
            <div className="card bg-base-200">
              <div className="card-body">
                <h4 className="card-title">View Batch</h4>
                <div className="flex gap-2">
                  <input className="input input-bordered flex-1" placeholder="Batch ID" value={viewBatchId} onChange={(e) => setViewBatchId(e.target.value)} />
                  <button
                    className={`btn btn-secondary ${loading ? 'loading' : ''}`}
                    disabled={loading || !appId}
                    onClick={(e) => {
                      e.preventDefault()
                      void viewBatch()
                    }}
                  >
                    View
                  </button>
                </div>
                {batchInfo && (
                  <div className="mt-4 p-4 bg-base-300 rounded">
                    <p><strong>Batch ID:</strong> {batchInfo.batchId}</p>
                    <p><strong>Producer:</strong> {batchInfo.producer}</p>
                    <p><strong>Product:</strong> {batchInfo.productName}</p>
                    <p><strong>Origin:</strong> {batchInfo.originLocation}</p>
                    <p><strong>Harvest Date:</strong> {new Date(Number(batchInfo.harvestDate) * 1000).toLocaleDateString()}</p>
                    <p><strong>Status:</strong> <span className={`badge ${batchInfo.status === 'APPROVED' ? 'badge-success' : batchInfo.status === 'REJECTED' || batchInfo.status === 'RECALLED' ? 'badge-error' : 'badge-warning'}`}>{batchInfo.status}</span></p>
                    {batchInfo.ipfsHash && <p><strong>IPFS Hash:</strong> <a href={`https://ipfs.io/ipfs/${batchInfo.ipfsHash}`} target="_blank" rel="noopener noreferrer" className="link">{batchInfo.ipfsHash}</a></p>}
                    {batchInfo.inspectionReportHash && <p><strong>Inspection Report:</strong> <a href={`https://ipfs.io/ipfs/${batchInfo.inspectionReportHash}`} target="_blank" rel="noopener noreferrer" className="link">{batchInfo.inspectionReportHash}</a></p>}
                  </div>
                )}
              </div>
            </div>
          )}
          <div className="modal-action">
            <button className="btn" onClick={closeModal} disabled={loading}>Close</button>
          </div>
        </div>
      </form>
    </dialog>
  )
}

export default FoodSafety
