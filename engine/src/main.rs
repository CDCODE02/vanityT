use clap::Parser;
use k256::{ProjectivePoint, Scalar, elliptic_curve::{sec1::ToEncodedPoint, PrimeField}, FieldBytes};
use rand::RngCore;
use rayon::prelude::*;
use sha3::{Digest, Keccak256};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Instant;

#[derive(Parser, Debug)]
#[command(author, version, about, long_about = None)]
struct Args {
    #[arg(short, long, default_value = "")]
    prefix: String,

    #[arg(short, long, default_value = "")]
    suffix: String,

    #[arg(short, long, default_value_t = 1000000)]
    batch_size: usize,
}

fn main() {
    let args = Args::parse();
    let prefix_bytes = hex::decode(args.prefix.trim_start_matches("0x")).expect("Invalid prefix hex");
    let suffix_bytes = hex::decode(args.suffix.trim_start_matches("0x")).expect("Invalid suffix hex");

    println!("🚀 Starting high-performance native search...");
    println!("🎯 Target Prefix: 0x{}", hex::encode(&prefix_bytes));
    println!("🎯 Target Suffix: 0x{}", hex::encode(&suffix_bytes));
    println!("🧵 Using all {} logical cores", rayon::current_num_threads());

    let running = Arc::new(AtomicBool::new(true));
    let start_time = Instant::now();
    let total_attempts = Arc::new(std::sync::atomic::AtomicU64::new(0));

    // Stats printing thread
    let stats_running = running.clone();
    let stats_attempts = total_attempts.clone();
    std::thread::spawn(move || {
        let mut last_attempts = 0;
        let mut last_time = Instant::now();
        while stats_running.load(Ordering::Relaxed) {
            std::thread::sleep(std::time::Duration::from_millis(1000));
            let current_attempts = stats_attempts.load(Ordering::Relaxed);
            let now = Instant::now();
            let delta_attempts = current_attempts - last_attempts;
            let delta_time = now.duration_since(last_time).as_secs_f64();
            
            println!(
                "📊 Speed: {:.2} MH/s | Total: {} | Time: {}s",
                (delta_attempts as f64 / delta_time) / 1_000_000.0,
                current_attempts,
                now.duration_since(start_time).as_secs()
            );
            
            last_attempts = current_attempts;
            last_time = now;
        }
    });

    // Parallel search
    (0..rayon::current_num_threads()).into_par_iter().for_each(|_| {
        let mut rng = rand::thread_rng();
        let mut hasher = Keccak256::new();
        let step = ProjectivePoint::GENERATOR;

        while running.load(Ordering::Relaxed) {
            let mut priv_bytes = [0u8; 32];
            rng.fill_bytes(&mut priv_bytes);
            
            let mut scalar = match Scalar::from_repr(*FieldBytes::from_slice(&priv_bytes)).into() {
                Some(s) => s,
                None => continue,
            };

            let mut current_point = ProjectivePoint::GENERATOR * scalar;

            for _ in 0..args.batch_size {
                if !running.load(Ordering::Relaxed) { break; }

                let affine = current_point.to_affine();
                let encoded = affine.to_encoded_point(false);
                let pub_bytes = encoded.as_bytes();

                hasher.update(&pub_bytes[1..]);
                let hash = hasher.finalize_reset();
                let address = &hash[12..32];

                let prefix_match = address.starts_with(&prefix_bytes);
                let suffix_match = address.ends_with(&suffix_bytes);

                if prefix_match && suffix_match {
                    running.store(false, Ordering::SeqCst);
                    let elapsed = start_time.elapsed();
                    
                    println!("\n✨ MATCH FOUND! ✨");
                    println!("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
                    println!("📍 Address:     0x{}", hex::encode(address));
                    println!("🔑 Private Key: 0x{}", hex::encode(scalar.to_bytes()));
                    println!("⏱️  Time:        {:?}", elapsed);
                    println!("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
                    return;
                }

                current_point += step;
                scalar += Scalar::ONE;
            }
            total_attempts.fetch_add(args.batch_size as u64, Ordering::Relaxed);
        }
    });
}
