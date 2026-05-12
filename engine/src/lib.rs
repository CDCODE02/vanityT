//! # VanityEngine Compute Core
//! 
//! This module implements a high-performance vanity address generator for EVM chains.
//! 
//! ## Optimizations
//! - **Incremental Point Addition:** Uses `P = P + G` instead of full scalar multiplication for each attempt.
//! - **Zero Heap Allocations:** The hot loop is free of heap allocations to maximize throughput.
//! - **Direct Byte Matching:** Prefix/suffix comparisons are performed on raw byte arrays.
//! - **Keccak Reuse:** Reuses the hasher state to minimize initialization overhead.

use wasm_bindgen::prelude::*;
use rand::RngCore;
use k256::{ProjectivePoint, Scalar, elliptic_curve::{sec1::ToEncodedPoint, PrimeField}, FieldBytes};
use sha3::{Digest, Keccak256};
use zeroize::Zeroize;

#[wasm_bindgen]
pub struct MatchResult {
    private_key: String,
    address: String,
}

#[wasm_bindgen]
impl MatchResult {
    #[wasm_bindgen(getter)]
    pub fn private_key(&self) -> String {
        self.private_key.clone()
    }

    #[wasm_bindgen(getter)]
    pub fn address(&self) -> String {
        self.address.clone()
    }
}

#[wasm_bindgen]
pub struct VanityEngine {
    generator: ProjectivePoint,
}

#[wasm_bindgen]
impl VanityEngine {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        Self {
            generator: ProjectivePoint::GENERATOR,
        }
    }

    #[wasm_bindgen]
    pub fn search_batch(
        &self,
        prefix: &[u8],
        suffix: &[u8],
        batch_size: usize,
    ) -> Option<MatchResult> {
        let mut rng = rand::thread_rng();
        let mut priv_bytes = [0u8; 32];
        rng.fill_bytes(&mut priv_bytes);

        // Start with a random scalar
        let mut scalar: Scalar = match Scalar::from_repr(*FieldBytes::from_slice(&priv_bytes)).into() {
            Some(s) => s,
            None => return None, // Extremely unlikely
        };

        let mut current_point: ProjectivePoint = self.generator * scalar;
        let step = self.generator;

        let prefix_len = prefix.len();
        let suffix_len = suffix.len();

        let mut hasher = Keccak256::new();
        
        for _ in 0..batch_size {
            // Convert to affine to get bytes
            let affine = current_point.to_affine();
            let encoded = affine.to_encoded_point(false);
            let pub_bytes = encoded.as_bytes(); // [0x04, x_bytes, y_bytes]

            // Keccak256 of the 64-byte pubkey (excluding the 0x04 prefix)
            hasher.update(&pub_bytes[1..]);
            let hash = hasher.finalize_reset();

            // Address is the last 20 bytes of the hash
            let address = &hash[12..32];

            // Byte-level matching
            let mut is_match = true;
            
            // Prefix check
            if prefix_len > 0 {
                for i in 0..prefix_len {
                    if address[i] != prefix[i] {
                        is_match = false;
                        break;
                    }
                }
            }

            // Suffix check
            if is_match && suffix_len > 0 {
                let offset = 20 - suffix_len;
                for i in 0..suffix_len {
                    if address[offset + i] != suffix[i] {
                        is_match = false;
                        break;
                    }
                }
            }

            if is_match {
                let priv_hex = format!("0x{}", hex::encode(scalar.to_bytes()));
                let addr_hex = format!("0x{}", hex::encode(address));
                
                priv_bytes.zeroize();
                return Some(MatchResult {
                    private_key: priv_hex,
                    address: addr_hex,
                });
            }

            // Increment
            current_point += step;
            scalar += Scalar::ONE;
        }

        priv_bytes.zeroize();
        None
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use k256::elliptic_curve::sec1::ToEncodedPoint;

    #[test]
    fn test_incremental_correctness() {
        let _engine = VanityEngine::new();
        let generator = ProjectivePoint::GENERATOR;
        
        let mut priv_bytes = [0u8; 32];
        priv_bytes[31] = 1; // scalar = 1
        let mut scalar: Scalar = Scalar::from_repr(*FieldBytes::from_slice(&priv_bytes)).unwrap();
        
        let mut current_point: ProjectivePoint = generator * scalar;
        
        for _ in 0..100 {
            let affine = current_point.to_affine();
            let _encoded = affine.to_encoded_point(false);
            
            // Check against full multiplication
            let expected_point = generator * scalar;
            assert_eq!(affine, expected_point.to_affine());
            
            current_point += generator;
            scalar += Scalar::ONE;
        }
    }
}
