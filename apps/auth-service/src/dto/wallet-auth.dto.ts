// apps/auth-service/src/auth/dto/wallet-auth.dto.ts

export interface CreateWalletChallengeDto {
    walletAddress: string;
}

export interface WalletLoginDto {
    walletAddress: string;
    challengeId: string;
    signature: unknown;
}