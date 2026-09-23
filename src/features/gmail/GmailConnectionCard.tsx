import GmailSyncButton from './GmailSyncButton'

interface Props {
  userId: string
}

export default function GmailConnectionCard({ userId }: Props) {
  void userId

  return <GmailSyncButton />
}
