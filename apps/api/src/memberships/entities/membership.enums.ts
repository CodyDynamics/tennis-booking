export enum MembershipStatus {
  PENDING_PAYMENT = "pending_payment",
  ACTIVE = "active",
  GRACE = "grace",
  LAPSED = "lapsed",
  CANCELLED = "cancelled",
}

export enum MembershipTransactionType {
  INITIATION = "initiation",
  MONTHLY = "monthly",
  REFUND = "refund",
  ADJUSTMENT = "adjustment",
  PROMO = "promo",
}
