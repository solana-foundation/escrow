# Install dependencies
install:
    pnpm install

# Generate IDL from Rust code using Codama
generate-idl:
    @echo "Generating IDL..."
    pnpm run generate-idl

# Generate clients from IDL using Codama
generate-clients: generate-idl
    @echo "Generating clients..."
    pnpm run generate-clients

# Build the program
build: generate-idl generate-clients build-test-hook
    cd program && cargo-build-sbf

# Build test hook program variants (allow + deny)
build-test-hook:
    cd tests/test-hook-program && cargo-build-sbf --features allow
    cp target/deploy/test_hook_program.so target/deploy/test_hook_allow.so
    cd tests/test-hook-program && cargo-build-sbf --features deny
    cp target/deploy/test_hook_program.so target/deploy/test_hook_deny.so

# Format / lint code
fmt:
    cargo fmt -p escrow-program -p tests-escrow-program
    @cd program && cargo clippy --all-targets -- -D warnings
    @cd tests && cargo clippy --all-targets -- -D warnings
    pnpm format
    pnpm --filter @solana/escrow build
    pnpm lint:fix

check:
    cd program && cargo check --features idl
    pnpm run format:check
    pnpm --filter @solana/escrow build
    pnpm lint
    pnpm run typecheck

# TypeScript type checking across all workspaces
typecheck:
    pnpm --filter @solana/escrow build
    pnpm -r run typecheck

# Run unit tests
unit-test:
    cargo test -p escrow-program

# Run integration tests (use --with-cu to track compute units and update README)
integration-test *args:
    #!/usr/bin/env bash
    set -e
    if [[ "{{ args }}" == *"--with-cu"* ]]; then
    	./scripts/integration-test-with-cu.sh
    else
    	cargo test -p tests-escrow-program "$@"
    fi

# Run all tests (use --with-cu to track compute units)
test *args: build unit-test (integration-test args)

# Deploy the web UI to Vercel production
deploy-web:
    vercel deploy --prod

# Build Client for Examples
build-client:
    pnpm run generate-clients
    cd clients/typescript && pnpm build
    cd examples/typescript/escrow-demo && pnpm install
# ******************************************************************************
# Deployment (requires txtx CLI: https://docs.txtx.sh/install)
# ******************************************************************************

[private]
check-txtx:
    @command -v txtx >/dev/null 2>&1 || { echo "Error: txtx not found. Install from: https://docs.txtx.sh/install"; exit 1; }

# Deploy to devnet (supervised mode with web UI)
deploy-devnet: check-txtx
    txtx run deploy --env devnet

# Deploy to devnet (unsupervised/CI mode)
deploy-devnet-ci: check-txtx
    txtx run deploy --env devnet -u

# Deploy to localnet (for testing with local validator)
deploy-localnet: check-txtx
    txtx run deploy --env localnet

# ******************************************************************************
# IDL Deployment (uses Program Metadata Program)
# ******************************************************************************

[private]
check-program-metadata:
    @command -v program-metadata >/dev/null 2>&1 || { echo "Error: program-metadata not installed. See https://github.com/solana-program/program-metadata"; exit 1; }

# Deploy IDL to devnet
deploy-idl-devnet: check-program-metadata
    program-metadata write idl Escrowae7RaUfNn4oEZHywMXE5zWzYCXenwrCDaEoifg idl/escrow_program.json \
        --keypair .keypairs/escrow-devnet-deployer.json \
        --rpc https://api.devnet.solana.com

# Deploy IDL to mainnet
deploy-idl-mainnet: check-program-metadata
    program-metadata write idl Escrowae7RaUfNn4oEZHywMXE5zWzYCXenwrCDaEoifg idl/escrow_program.json \
        --keypair .keypairs/escrow-mainnet-deployer.json \
        --rpc https://api.mainnet-beta.solana.com

# ******************************************************************************
# Build Verification (uses solana-verify CLI)
# ******************************************************************************

[private]
check-solana-verify:
    @command -v solana-verify >/dev/null 2>&1 || { echo "Error: solana-verify not installed. Run: cargo install solana-verify"; exit 1; }

# Verify mainnet deployment against repo (remote build via OtterSec)
# Note: Remote verification (--remote) only works on mainnet
# Apple Silicon (local builds without --remote): enable Docker/Colima Rosetta and
# `export DOCKER_DEFAULT_PLATFORM=linux/amd64`. The pinned verify image is amd64-only,
# so the SBF build fails on getrandom under arm64 emulation without it.
verify-mainnet: check-solana-verify
    solana-verify verify-from-repo \
        https://github.com/solana-foundation/escrow \
        --program-id Escrowae7RaUfNn4oEZHywMXE5zWzYCXenwrCDaEoifg \
        --library-name escrow_program \
        --remote \
        -um

verify-local: check-solana-verify
    solana-verify build --library-name escrow_program

# ******************************************************************************
# Release
# ******************************************************************************

# Prepare a new release (bumps versions, generates changelog)
[confirm('Start release process?')]
release:
    #!/usr/bin/env bash
    set -euo pipefail

    if [ -n "$(git status --porcelain)" ]; then
    	echo "Error: Working directory not clean"
    	exit 1
    fi

    command -v git-cliff &>/dev/null || { echo "Install git-cliff: cargo install git-cliff"; exit 1; }

    # Get current versions
    rust_version=$(grep "^version" clients/rust/Cargo.toml | head -1 | sed 's/version = "\(.*\)"/\1/')
    ts_version=$(node -p "require('./clients/typescript/package.json').version")

    echo "Current versions:"
    echo "  Rust client:       $rust_version"
    echo "  TypeScript client: $ts_version"
    echo ""

    read -p "New version: " version
    [ -z "$version" ] && { echo "Version required"; exit 1; }

    echo "Updating to $version..."

    # Update Rust client version
    sed -i.bak "s/^version = \".*\"/version = \"$version\"/" clients/rust/Cargo.toml
    rm -f clients/rust/Cargo.toml.bak

    # Update TypeScript client version
    cd clients/typescript && npm version "$version" --no-git-tag-version --allow-same-version
    cd ../..

    echo "Generating CHANGELOG..."
    last_tag=$(git tag -l "v*" --sort=-version:refname | head -1)
    if [ -z "$last_tag" ]; then
    	git-cliff --config .github/cliff.toml --tag "v$version" --output CHANGELOG.md --strip all
    elif [ -f CHANGELOG.md ]; then
    	git-cliff "$last_tag"..HEAD --tag "v$version" --config .github/cliff.toml --strip all > CHANGELOG.new.md
    	cat CHANGELOG.md >> CHANGELOG.new.md
    	mv CHANGELOG.new.md CHANGELOG.md
    else
    	git-cliff "$last_tag"..HEAD --tag "v$version" --config .github/cliff.toml --output CHANGELOG.md --strip all
    fi

    git add clients/rust/Cargo.toml clients/typescript/package.json CHANGELOG.md

    echo ""
    echo "Ready! Next steps:"
    echo "  git commit -m 'chore: release v$version'"
    echo "  git push origin HEAD"
    echo "  Trigger 'Publish Rust Client' and 'Publish TypeScript Client' workflows"
