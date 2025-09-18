# Ventbuddy

A privacy-preserving social space that allows people to express themselves, share experiences, and find support without compromising their identity.

## 🔐 Privacy-First Design

Built on Zama's FHEVM (Fully Homomorphic Encryption Virtual Machine), Ventbuddy ensures that sensitive user data — including identities, posts, and interactions — remain encrypted end-to-end.

## 🌟 Key Features

- **Anonymous Conversations**: Engage in open discussions while maintaining complete privacy
- **Emotional Support**: Provide and receive support in a safe, confidential environment
- **Community Building**: Build communities around shared struggles and experiences
- **End-to-End Encryption**: All data encrypted using FHE technology
- **Zero-Knowledge Proofs**: Verify interactions without revealing sensitive information
- **Encrypted Smart Contracts**: On-chain privacy for all transactions and interactions

## 🚀 Technology Stack

- **Frontend**: React + TypeScript + Vite
- **Blockchain**: Ethereum Sepolia Testnet
- **Encryption**: Zama FHEVM (Fully Homomorphic Encryption)
- **Database**: Supabase (encrypted data storage)
- **UI**: Tailwind CSS + shadcn/ui components

## 🌐 Live Demo

Ventbuddy is currently live as a proof-of-concept at [vb.yeetcaster.xyz](https://vb.yeetcaster.xyz), where developers and early adopters can test, explore, and give feedback.

## 🏗️ Architecture

Ventbuddy represents the first Web3 townhall designed for anonymous yet trustworthy conversations, powered by:

- **FHE (Fully Homomorphic Encryption)**: Enables computation on encrypted data
- **Zero-Knowledge Proofs**: Verify interactions without revealing data
- **Encrypted Smart Contracts**: Privacy-preserving blockchain interactions
- **Real-time Updates**: Supabase real-time subscriptions for live interactions

## 🛠️ Development

### Prerequisites

- Node.js 18+ 
- npm or yarn
- MetaMask or compatible Web3 wallet
- Sepolia testnet ETH

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd ventbuddy-app/frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

### Environment Setup

Create a `.env.local` file with the following variables:

```env
# Supabase Configuration
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

# Contract Configuration
VITE_CONTRACT_ADDRESS=your_contract_address
VITE_CHAIN_ID=11155111

# FHEVM Configuration
VITE_RELAYER_URL=https://relayer.testnet.zama.cloud
VITE_ACL_CONTRACT=your_acl_contract_address
VITE_KMS_VERIFIER_CONTRACT=your_kms_contract_address
VITE_INPUT_VERIFIER_CONTRACT=your_input_verifier_contract_address
```

## 📱 Usage

1. **Connect Wallet**: Connect your MetaMask wallet to Sepolia testnet
2. **Register**: Create your encrypted identity using FHEVM
3. **Create Posts**: Share your thoughts with privacy-preserving encryption
4. **Engage**: Reply, tip, and interact with other users anonymously
5. **Support**: Provide and receive emotional support in a safe environment

## 🔒 Privacy & Security

- All user identities are encrypted using FHEVM
- Posts and replies are encrypted before storage
- Smart contract interactions preserve privacy
- Zero-knowledge proofs verify interactions without revealing data
- No personal information is stored in plain text

## 🤝 Contributing

We welcome contributions from developers and privacy advocates! Please see our contributing guidelines for more information.

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🌟 Acknowledgments

- [Zama](https://zama.ai/) for FHEVM technology
- [Supabase](https://supabase.com/) for backend infrastructure
- [Vite](https://vitejs.dev/) for build tooling
- [Tailwind CSS](https://tailwindcss.com/) for styling

---

**Ventbuddy** - Where privacy meets community. 