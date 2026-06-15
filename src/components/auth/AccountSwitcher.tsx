// NOTE: This file is stable and usually should not be modified.
// It is important that all functionality in this file is preserved, and should only be modified if explicitly requested.

import { useState } from 'react';
import { ChevronDown, LogOut, UserIcon, UserPlus, Info, Heart, ExternalLink, Bitcoin, Zap, Shield, Globe, Copy, AlertTriangle, RotateCw, Cloud, LogIn, Sun, Moon, GraduationCap, Wallet } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu.tsx';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar.tsx';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useLoggedInAccounts, type Account } from '@/hooks/useLoggedInAccounts';
import { genUserName } from '@/lib/genUserName';
import { useTheme } from '@/hooks/useTheme';
import { useRegisterSW } from '@/hooks/useRegisterSW';

interface AccountSwitcherProps {
  onAddAccountClick: () => void;
  onBudgetPartnersClick?: () => void;
  partnersCount?: number;
  pendingInvitesCount?: number;
  // Handlers for the merged hamburger-menu content
  onOpenWallet?: () => void;
  onOpenMapleSettings?: () => void;
  onOpenPaymentMethods?: () => void;
  onCopyPreviousMonth?: () => void;
  onResetBudgetMonth?: () => void;
  onRefreshApp?: () => void;
  onOpenBackup?: () => void;
}

export function AccountSwitcher({ onAddAccountClick, onBudgetPartnersClick, partnersCount = 0, pendingInvitesCount = 0 }: AccountSwitcherProps) {
  const { currentUser, otherUsers, setLogin, removeLogin } = useLoggedInAccounts();
  const { isDark, toggle: toggleTheme } = useTheme();
  const { needRefresh } = useRegisterSW();
  const [showAbout, setShowAbout] = useState(false);
  const [showDonate, setShowDonate] = useState(false);

  if (!currentUser) return null;

  const getDisplayName = (account: Account): string => {
    return account.metadata.name ?? genUserName(account.pubkey);
  }

  const hasPendingInvites = pendingInvitesCount > 0;

  return (
    <>
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <button className='flex items-center gap-3 p-3 rounded-full hover:bg-accent transition-all w-full text-foreground'>
          <div className='relative'>
            <Avatar className='w-10 h-10'>
              <AvatarImage src={currentUser.metadata.picture} alt={getDisplayName(currentUser)} />
              <AvatarFallback>{getDisplayName(currentUser).charAt(0)}</AvatarFallback>
            </Avatar>
            {hasPendingInvites && (
              <span
                className='absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-background'
                title={`${pendingInvitesCount} pending invite${pendingInvitesCount !== 1 ? 's' : ''}`}
              >
                {pendingInvitesCount > 9 ? '9+' : pendingInvitesCount}
              </span>
            )}
          </div>
          <div className='flex-1 text-left hidden md:block truncate'>
            <p className='font-medium text-sm truncate'>{getDisplayName(currentUser)}</p>
          </div>
          <ChevronDown className='w-4 h-4 text-muted-foreground' />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className='w-56 p-2 animate-scale-in'>
        <div className='font-medium text-sm px-2 py-1.5'>Switch Account</div>
        {otherUsers.map((user) => (
          <DropdownMenuItem
            key={user.id}
            onClick={() => setLogin(user.id)}
            className='flex items-center gap-2 cursor-pointer p-2 rounded-md'
          >
            <Avatar className='w-8 h-8'>
              <AvatarImage src={user.metadata.picture} alt={getDisplayName(user)} />
              <AvatarFallback>{getDisplayName(user)?.charAt(0) || <UserIcon />}</AvatarFallback>
            </Avatar>
            <div className='flex-1 truncate'>
              <p className='text-sm font-medium'>{getDisplayName(user)}</p>
            </div>
            {user.id === currentUser.id && <div className='w-2 h-2 rounded-full bg-primary'></div>}
          </DropdownMenuItem>
         ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => removeLogin(currentUser.id)}
            className='flex items-center gap-2 cursor-pointer p-2 rounded-md text-red-500'
          >
            <LogOut className='w-4 h-4' />
            <span>Log out</span>
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          {/* Budget Tools (merged from hamburger menu) */}
          <DropdownMenuItem onClick={onCopyPreviousMonth}>
            <Copy className="h-4 w-4 mr-2" />
            Copy Previous Month
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onResetBudgetMonth} className="text-destructive focus:text-destructive">
            <AlertTriangle className="h-4 w-4 mr-2" />
            Reset This Month
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          {/* AI & Wallet */}
          <DropdownMenuItem onClick={onOpenMapleSettings}>
            <span className="h-4 w-4 mr-2 text-center text-sm">🤖</span>
            Maple AI
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onOpenPaymentMethods}>
            <span className="h-4 w-4 mr-2 text-center text-sm">💳</span>
            Payment Methods
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onOpenWallet}>
            <Wallet className="h-4 w-4 mr-2" />
            Lightning Wallet
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          {/* Preferences */}
          <DropdownMenuItem onClick={toggleTheme}>
            {isDark ? <Sun className="h-4 w-4 mr-2" /> : <Moon className="h-4 w-4 mr-2" />}
            {isDark ? 'Light Mode' : 'Dark Mode'}
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          {/* Support */}
          <DropdownMenuItem>
            <Heart className="h-4 w-4 mr-2 text-pink-500" />
            Support Sat Sorter
          </DropdownMenuItem>
          <DropdownMenuItem>
            <Heart className="h-4 w-4 mr-2" />
            Support Bitcoin Projects
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          {/* About & Learn */}
          <DropdownMenuItem onClick={() => setShowAbout(true)}>
            <Info className="h-4 w-4 mr-2" />
            About Sat Sorter
          </DropdownMenuItem>
          <DropdownMenuItem>
            <GraduationCap className="h-4 w-4 mr-2" />
            Learn About Bitcoin
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          {/* Advanced */}
          <DropdownMenuItem onClick={onRefreshApp}>
            <RotateCw className="h-4 w-4 mr-2" />
            Refresh App
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onOpenBackup}>
            <Cloud className="h-4 w-4 mr-2" />
            Backup & Sync
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

    {/* About Dialog */}
    <Dialog open={showAbout} onOpenChange={setShowAbout}>
      <DialogContent className="sm:max-w-[500px] max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            About Sat Sorter
          </DialogTitle>
          <DialogDescription>
            Zero-based budgeting on a Bitcoin standard
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[60vh] pr-4">
          <div className="space-y-6 py-4">
            {/* What is Sat Sorter */}
            <div className="space-y-2">
              <h3 className="font-semibold flex items-center gap-2">
                <Bitcoin className="h-4 w-4 text-primary" />
                What is Sat Sorter?
              </h3>
              <p className="text-sm text-muted-foreground">
                Sat Sorter is a privacy-first budgeting app built for Bitcoiners.
                It uses the zero-based budgeting method — where every satoshi gets assigned a job
                before you spend it. No wasted sats, no wasted money.
              </p>
            </div>

            {/* How it works */}
            <div className="space-y-2">
              <h3 className="font-semibold flex items-center gap-2">
                <Zap className="h-4 w-4 text-primary" />
                How It Works
              </h3>
              <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                <li>Add your monthly income in sats</li>
                <li>Create categories for your expenses</li>
                <li>Assign every sat to a category until you hit zero</li>
                <li>Track your spending and stay on budget</li>
                <li>Connect your Lightning wallet for automatic tracking</li>
              </ul>
            </div>

            {/* Privacy */}
            <div className="space-y-2">
              <h3 className="font-semibold flex items-center gap-2">
                <Shield className="h-4 w-4 text-primary" />
                100% Private
              </h3>
              <p className="text-sm text-muted-foreground">
                Your data stays on your device. We don't have servers that store your financial information.
                When you log in with Nostr, your budget syncs securely using your own keys.
                Not your keys, not your budget — wait, that's actually how it should work!
              </p>
            </div>

            {/* Why Bitcoin */}
            <div className="space-y-2">
              <h3 className="font-semibold flex items-center gap-2">
                <Globe className="h-4 w-4 text-primary" />
                Why Bitcoin?
              </h3>
              <p className="text-sm text-muted-foreground">
                Bitcoin is sound money. Unlike fiat currencies that lose value every year through inflation,
                Bitcoin has a fixed supply of 21 million coins. When you budget in sats, you're planning
                with money that can't be devalued by central banks. Your savings actually stay saved.
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                <strong>Fun fact:</strong> 1 Bitcoin = 100,000,000 satoshis (sats).
                That's why we count every sat — they add up!
              </p>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>

    {/* Donate Dialog */}
    <Dialog open={showDonate} onOpenChange={setShowDonate}>
      <DialogContent className="sm:max-w-[500px] max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Heart className="h-5 w-5 text-pink-500" />
            Support Bitcoin Projects
          </DialogTitle>
          <DialogDescription>
            Help build the future of freedom technology
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[60vh] pr-4">
          <div className="space-y-6 py-4">
            <p className="text-sm text-muted-foreground">
              Bitcoin and the tools around it are built by passionate developers working on open-source projects.
              Your donations help keep these projects alive and growing. Consider adding a "Donations" line item
              to your budget — it's an investment in freedom.
            </p>

            {/* OpenSats */}
            <div className="p-4 border rounded-lg space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">OpenSats</h3>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open('https://opensats.org', '_blank')}
                >
                  <ExternalLink className="h-3 w-3 mr-1" />
                  Visit
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                Funds open-source Bitcoin and Nostr developers. 100% of donations go to grants.
              </p>
            </div>

            {/* HRF */}
            <div className="p-4 border rounded-lg space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Human Rights Foundation</h3>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open('https://hrf.org/devfund', '_blank')}
                >
                  <ExternalLink className="h-3 w-3 mr-1" />
                  Visit
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                The Bitcoin Development Fund supports developers building privacy and freedom tools.
              </p>
            </div>

            {/* Brink */}
            <div className="p-4 border rounded-lg space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Brink</h3>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open('https://brink.dev', '_blank')}
                >
                  <ExternalLink className="h-3 w-3 mr-1" />
                  Visit
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                Supports Bitcoin Core developers working on the protocol itself.
              </p>
            </div>

            {/* Geyser */}
            <div className="p-4 border rounded-lg space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Geyser Fund</h3>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open('https://geyser.fund', '_blank')}
                >
                  <ExternalLink className="h-3 w-3 mr-1" />
                  Visit
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                Crowdfunding platform for Bitcoin projects. Find and support grassroots initiatives.
              </p>
            </div>

            <p className="text-xs text-muted-foreground text-center pt-2">
              "We shape our tools, and thereafter our tools shape us." — Marshall McLuhan
            </p>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
    </>
  );
}