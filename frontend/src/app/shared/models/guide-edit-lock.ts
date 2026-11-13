export interface GuideEditLock {
  id: string;
  name: string;
  startsAt: string;
  endsAt: string;
  reason: string;
  createdBy: { id: string; name: string };
  createdAt: string;
  active: boolean;
}

export interface NewGuideEditLock {
  name: string;
  startsAt: string;
  endsAt: string;
  reason: string;
}
