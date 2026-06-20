export const percolatorFixture = {
  source: {
    label: "Percolator decoded fixture",
    mode: "read-only",
    pinnedCommit: "d586a871",
    generatedAt: "2026-06-20T14:40:00.000Z"
  },
  cluster: "local fixture",
  currentSlot: 346892110,
  markets: [
    {
      id: "sol-perp",
      name: "SOL-PERP",
      base: "SOL",
      quote: "USDC",
      status: "live",
      slab: "PERCOLAT_SOL_8k4q...Qp2",
      program: "Perco1ator111111111111111111111111111111111",
      header: {
        version: 16,
        flags: ["oracle_initialized"],
        nonce: "1181049",
        admin: "A3Mu2nQd...MrCK"
      },
      config: {
        maxLeverage: 20,
        initialMarginBps: 820,
        maintenanceMarginBps: 500,
        liquidationFeeBps: 35,
        fundingMaxPremiumBps: 500,
        maxStalenessSecs: 8,
        confFilterBps: 45,
        permissionlessResolveStaleSlots: 432000,
        forceCloseDelaySlots: 432000
      },
      oracle: {
        indexPrice: 181.42,
        markPrice: 181.61,
        effectivePrice: 181.55,
        confidenceBps: 18,
        publishAgeSec: 2.1,
        targetAgeSec: 1.4,
        legs: [
          { name: "Pyth SOL/USD", weight: 0.72, ageSec: 1.8, confidenceBps: 18 },
          { name: "Switchboard backup", weight: 0.28, ageSec: 3.2, confidenceBps: 28 }
        ],
        pricePath: [179.8, 180.1, 179.6, 180.4, 181.0, 181.2, 180.9, 181.5, 181.61]
      },
      engine: {
        lastCrankSlot: 346892086,
        crankAgeSlots: 24,
        catchupRequired: false,
        staleAccounts: 1,
        fundingRateBpsPerHour: 0.82,
        fundingIndex: "18420312",
        openInterestUsd: 2430000,
        longOpenInterestUsd: 1320000,
        shortOpenInterestUsd: 1110000,
        stressConsumedBps: 118,
        stressLimitBps: 500,
        insuranceUsd: 148000,
        vaultUsd: 910000,
        claimUsd: 821000,
        socialLossUsd: 0,
        sideMode: "balanced"
      },
      account: {
        label: "Demo trader",
        side: "long",
        positionSize: 420,
        entryPrice: 174.3,
        collateralUsd: 8400,
        positionNotionalUsd: 76276.2,
        unrealizedPnlUsd: 3067.2,
        realizedPnlUsd: 540.8,
        fundingPnlUsd: -32.4,
        maintenanceMarginUsd: 3813.81,
        initialMarginUsd: 6254.65,
        liquidationPrice: 162.94,
        pnlPath: [620, 880, 540, 1320, 1940, 2430, 2260, 2870, 3067]
      },
      execution: {
        bestBid: 181.52,
        bestAsk: 181.71,
        impact10kBps: 8.4,
        impact50kBps: 31.2,
        markout1mBps: 4.2,
        markout5mBps: -1.7,
        fillQualityScore: 84,
        routeLatencyMs: 132,
        priorityFeeMicrolamports: 2200
      }
    },
    {
      id: "btc-perp",
      name: "BTC-PERP",
      base: "BTC",
      quote: "USDC",
      status: "watch",
      slab: "PERCOLAT_BTC_4u9p...Rx8",
      program: "Perco1ator111111111111111111111111111111111",
      header: {
        version: 16,
        flags: ["oracle_initialized"],
        nonce: "1181054",
        admin: "A3Mu2nQd...MrCK"
      },
      config: {
        maxLeverage: 15,
        initialMarginBps: 1050,
        maintenanceMarginBps: 650,
        liquidationFeeBps: 45,
        fundingMaxPremiumBps: 420,
        maxStalenessSecs: 8,
        confFilterBps: 38,
        permissionlessResolveStaleSlots: 432000,
        forceCloseDelaySlots: 432000
      },
      oracle: {
        indexPrice: 104280,
        markPrice: 104030,
        effectivePrice: 104118,
        confidenceBps: 31,
        publishAgeSec: 5.7,
        targetAgeSec: 4.9,
        legs: [
          { name: "Pyth BTC/USD", weight: 0.64, ageSec: 5.1, confidenceBps: 31 },
          { name: "Chainlink mirror", weight: 0.36, ageSec: 6.3, confidenceBps: 34 }
        ],
        pricePath: [104880, 104620, 104720, 104510, 104330, 104240, 104390, 104100, 104030]
      },
      engine: {
        lastCrankSlot: 346891992,
        crankAgeSlots: 118,
        catchupRequired: false,
        staleAccounts: 8,
        fundingRateBpsPerHour: -1.18,
        fundingIndex: "9302211",
        openInterestUsd: 4120000,
        longOpenInterestUsd: 1870000,
        shortOpenInterestUsd: 2250000,
        stressConsumedBps: 284,
        stressLimitBps: 500,
        insuranceUsd: 202000,
        vaultUsd: 1430000,
        claimUsd: 1392000,
        socialLossUsd: 0,
        sideMode: "short-heavy"
      },
      account: {
        label: "Demo trader",
        side: "short",
        positionSize: -0.68,
        entryPrice: 106120,
        collateralUsd: 11200,
        positionNotionalUsd: 70740.4,
        unrealizedPnlUsd: 1421.2,
        realizedPnlUsd: -180.6,
        fundingPnlUsd: 19.8,
        maintenanceMarginUsd: 4598.13,
        initialMarginUsd: 7427.74,
        liquidationPrice: 118920,
        pnlPath: [-410, -220, 160, 520, 890, 1240, 1010, 1320, 1421]
      },
      execution: {
        bestBid: 103970,
        bestAsk: 104115,
        impact10kBps: 12.7,
        impact50kBps: 47.9,
        markout1mBps: -2.8,
        markout5mBps: 5.5,
        fillQualityScore: 71,
        routeLatencyMs: 244,
        priorityFeeMicrolamports: 3300
      }
    },
    {
      id: "wif-perp",
      name: "WIF-PERP",
      base: "WIF",
      quote: "USDC",
      status: "risk",
      slab: "PERCOLAT_WIF_3z6h...Lm1",
      program: "Perco1ator111111111111111111111111111111111",
      header: {
        version: 16,
        flags: ["oracle_initialized", "risk_reduction"],
        nonce: "1181061",
        admin: "A3Mu2nQd...MrCK"
      },
      config: {
        maxLeverage: 10,
        initialMarginBps: 1600,
        maintenanceMarginBps: 900,
        liquidationFeeBps: 70,
        fundingMaxPremiumBps: 650,
        maxStalenessSecs: 6,
        confFilterBps: 60,
        permissionlessResolveStaleSlots: 216000,
        forceCloseDelaySlots: 216000
      },
      oracle: {
        indexPrice: 1.84,
        markPrice: 1.79,
        effectivePrice: 1.805,
        confidenceBps: 54,
        publishAgeSec: 8.8,
        targetAgeSec: 7.6,
        legs: [
          { name: "Pyth WIF/USD", weight: 0.7, ageSec: 8.8, confidenceBps: 54 },
          { name: "Switchboard backup", weight: 0.3, ageSec: 10.2, confidenceBps: 72 }
        ],
        pricePath: [2.02, 1.98, 1.93, 1.91, 1.88, 1.86, 1.82, 1.81, 1.79]
      },
      engine: {
        lastCrankSlot: 346891702,
        crankAgeSlots: 408,
        catchupRequired: true,
        staleAccounts: 42,
        fundingRateBpsPerHour: 3.9,
        fundingIndex: "721883",
        openInterestUsd: 690000,
        longOpenInterestUsd: 524000,
        shortOpenInterestUsd: 166000,
        stressConsumedBps: 426,
        stressLimitBps: 500,
        insuranceUsd: 22000,
        vaultUsd: 118000,
        claimUsd: 134000,
        socialLossUsd: 9400,
        sideMode: "risk-reduction"
      },
      account: {
        label: "Demo trader",
        side: "long",
        positionSize: 34000,
        entryPrice: 1.94,
        collateralUsd: 5900,
        positionNotionalUsd: 60860,
        unrealizedPnlUsd: -5100,
        realizedPnlUsd: 0,
        fundingPnlUsd: -126.8,
        maintenanceMarginUsd: 5477.4,
        initialMarginUsd: 9737.6,
        liquidationPrice: 1.765,
        pnlPath: [410, 90, -420, -980, -1840, -2620, -3860, -4580, -5100]
      },
      execution: {
        bestBid: 1.786,
        bestAsk: 1.803,
        impact10kBps: 42.6,
        impact50kBps: 138.9,
        markout1mBps: -18.5,
        markout5mBps: -44.1,
        fillQualityScore: 38,
        routeLatencyMs: 481,
        priorityFeeMicrolamports: 6100
      }
    }
  ]
};
