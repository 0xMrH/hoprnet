export enum NodeStates {
  adminModeDisabled = 'ADMIN_MODE_DISABLED',
  adminCommandReceived = 'ADMIN_COMMAND_RECEIVED',
  newUnverifiedNode = 'UNVERIFIED',
  tweetVerificationFailed = 'FAILED_TWITTER_VERIFICATION',
  tweetVerificationInProgress = 'IN_PROGRESS_TWITTER_VERIFICATION',
  tweetVerificationSucceeded = 'SUCCEEDED_TWITTER_VERIFICATION',
  xdaiBalanceFailed = 'FAILED_XDAI_BALANCE_VERIFICATION',
  xdaiBalanceSucceeded = 'SUCCEEDED_XDAI_BALANCE_VERIFICATION',
  relayingNodeFailed = 'FAILED_RELAYING_PACKET',
  relayingNodeInProgress = 'IN_PROGRESS_RELAYING_PACKET',
  relayingNodeSucceded = 'SUCCEEDED_RELAYING_PACKET',
  onlineNode = 'ONLINE',
  verifiedNode = 'VERIFIED',
}

export enum BotCommands {
  rules = 'RULES',
  status = 'STATUS',
  verify = 'VERIFY',
  help = 'HELP',
  stats = 'STATS',
  admin = 'ADMIN'
}

export enum ScoreRewards {
  verified = 100,
  relayed = 10,
}
