import { useState } from 'react';
import {
  ChevronDown, LogOut, UserIcon, Heart, Info, Copy, AlertTriangle, RotateCw,
  Cloud, LogIn, Sun, Moon, GraduationCap, Wallet, Menu, QrCode, Calendar,
  Users, Bug, Wifi, MessageSquare, CreditCard, KeyRound, BookOpen, Zap,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useLoggedInAccounts } from '@/hooks/useLoggedInAccounts';
import { genUserName } from '@/lib/genUserName';
import { cn } from '@/lib/utils';
import { useTheme } from '@/hooks/useTheme';
import { useRegisterSW } from '@/hooks/useRegisterSW';

interface AccountSwitcherProps {
  onAddAccountClick: () => void;
  onBudgetPartnersClick?: () => void;
  partnersCount?: number;
  pendingInvitesCount?: number;
  onShowBudgetKey?: () => void;
  onOpenWallet?: () => void;
  onOpenMapleSettings?: () => void;
  onOpenPaymentMethods?: () => void;
  onCopyPreviousMonth?: () => void;
  onPlanNextMonth?: () => void;
  onResetBudgetMonth?: () => void;
  onRefreshApp?: () => void;
  onUpdateApp?: () => void;
  onFactoryReset?: () => void;
  onOpenBackup?: () => void;
  onSupportSatSorter?: () => void;
  onSupportBitcoinProjects?: () => void;
  onAbout?: () => void;
  onLearnAboutBitcoin?: () => void;
  onOpenDebugLog?: () => void;
  onOpenRelaySettings?: () => void;
  onOpenAccountDetails?: () => void;
  onOpenWelcomeTour?: () => void;
  onOpenSubscription?: () => void;
  variant?: 'avatar' | 'hamburger';
  updateAvailable?: boolean;
  triggerClassName?: string;
}

export function AccountSwitcher({
  onAddAccountClick, onBudgetPartnersClick, partnersCount = 0, pendingInvitesCount = 0,
  onShowBudgetKey, onOpenWallet, onOpenMapleSettings, onOpenPaymentMethods,
  onCopyPreviousMonth, onPlanNextMonth, onResetBudgetMonth,
  onSoftReset, onHardReset, onTotalReset,
  onOpenBackup, onSupportSatSorter, onSupportBitcoinProjects,
  onAbout, onLearnAboutBitcoin, onOpenDebugLog, onOpenRelaySettings,
  onOpenAccountDetails, onOpenWelcomeTour, onOpenSubscription,
  variant = 'avatar', updateAvailable = false, triggerClassName,
}: AccountSwitcherProps) {
  const { currentUser, otherUsers, removeLogin } = useLoggedInAccounts();
  const { isDark, toggle: toggleTheme } = useTheme();
  const { needRefresh, softReset, hardReset, totalReset } = useRegisterSW();
  const showUpdateBadge = updateAvailable || needRefresh;
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const handleSoftReset = onSoftReset ?? softReset;

  if (!currentUser && variant === 'avatar') return null;

  const getDisplayName = (account: any): string => account.metadata.name ?? genUserName(account.pubkey);
  const hasPendingInvites = pendingInvitesCount > 0;

  const renderTrigger = () => {
    if (variant === 'hamburger') {
      return (
        <button className={cn('flex items-center gap-3 p-3 rounded-full hover:bg-accent transition-all w-full text-foreground', triggerClassName)}>
          <div className='relative'>
            {currentUser ? (
              <Avatar className='w-10 h-10'>
                <AvatarImage src={currentUser.metadata.picture} alt={getDisplayName(currentUser)} />
                <AvatarFallback>{getDisplayName(currentUser).charAt(0)}</AvatarFallback>
              </Avatar>
            ) : (
              <div className='w-10 h-10 rounded-full bg-muted flex items-center justify-center'>
                <Menu className='w-5 h-5' />
              </div>
            )}
            {showUpdateBadge && (
              <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-300 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-yellow-300" />
              </span>
            )}
          </div>
          {currentUser && (
            <div className='flex-1 text-left hidden md:block truncate'>
              <p className='font-medium text-sm truncate'>{getDisplayName(currentUser)}</p>
            </div>
          )}
          <ChevronDown className='w-4 h-4 text-muted-foreground' />
        </button>
      );
    }
    return (
      <button className={cn('flex items-center gap-1.5 p-1 rounded-full hover:bg-white/10 transition-all text-foreground shrink-0', triggerClassName)}>
        <div className='relative'>
          <Avatar className='w-8 h-8'>
            <AvatarImage src={currentUser!.metadata.picture} alt={getDisplayName(currentUser!)} />
            <AvatarFallback>{getDisplayName(currentUser!).charAt(0)}</AvatarFallback>
          </Avatar>
        </div>
        <div className='flex-1 text-left hidden md:block truncate'>
          <p className='font-medium text-sm truncate'>{getDisplayName(currentUser!)}</p>
        </div>
        <ChevronDown className='w-3.5 h-3.5 text-muted-foreground hidden sm:block' />
      </button>
    );
  };

  return (
    <>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          {renderTrigger()}
        </DropdownMenuTrigger>
        <DropdownMenuContent className='w-56 p-2 animate-scale-in'>

          {/* === ACCOUNT === */}
          {currentUser && (
            <>
              <DropdownMenuLabel className="text-xs text-muted-foreground uppercase tracking-wider">Account</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => onOpenAccountDetails?.()}>
                <KeyRound className="h-4 w-4 mr-2" />
                Account Details
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onBudgetPartnersClick?.()}>
                <Users className="h-4 w-4 mr-2" />
                Budget Partners
                {partnersCount > 0 && (
                  <span className="ml-auto text-xs text-muted-foreground">{partnersCount}</span>
                )}
              </DropdownMenuItem>
            </>
          )}
          {!currentUser && (
            <DropdownMenuItem onClick={onAddAccountClick}>
              <LogIn className="h-4 w-4 mr-2" />
              Log In with Nostr
            </DropdownMenuItem>
          )}

          <DropdownMenuSeparator />

          {/* === BUDGET TOOLS === */}
          <DropdownMenuLabel className="text-xs text-muted-foreground uppercase tracking-wider">Budget Tools</DropdownMenuLabel>
          {onOpenSubscription && (
            <DropdownMenuItem onClick={onOpenSubscription}>
              <Zap className="h-4 w-4 mr-2 text-amber-500" />
              Power-Ups & Access
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onClick={() => onCopyPreviousMonth?.()}>
            <Copy className="h-4 w-4 mr-2" />
            Copy Previous Month
          </DropdownMenuItem>
          {onPlanNextMonth && (
            <DropdownMenuItem onClick={() => onPlanNextMonth()}>
              <Calendar className="h-4 w-4 mr-2" />
              Plan Next Month
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onClick={() => onOpenMapleSettings?.()}>
            <MessageSquare className="h-4 w-4 mr-2" />
            Budget Buddy
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onOpenPaymentMethods?.()}>
            <CreditCard className="h-4 w-4 mr-2" />
            Payment Methods
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onOpenWallet?.()}>
            <Wallet className="h-4 w-4 mr-2" />
            Lightning Wallet
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          {/* === SETTINGS === */}
          <DropdownMenuLabel className="text-xs text-muted-foreground uppercase tracking-wider">Settings</DropdownMenuLabel>
          <DropdownMenuItem onClick={() => onOpenBackup?.()}>
            <Cloud className="h-4 w-4 mr-2" />
            Backup & Sync
          </DropdownMenuItem>
          <DropdownMenuItem onClick={toggleTheme}>
            {isDark ? <Sun className="h-4 w-4 mr-2" /> : <Moon className="h-4 w-4 mr-2" />}
            {isDark ? 'Light Mode' : 'Dark Mode'}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleSoftReset?.()}>
            <RotateCw className="h-4 w-4 mr-2" />
            Refresh the app
          </DropdownMenuItem>
          {onOpenDebugLog && (
            <DropdownMenuItem onClick={onOpenDebugLog}>
              <Bug className="h-4 w-4 mr-2" />
              Sync Debug Log
            </DropdownMenuItem>
          )}
          {onOpenRelaySettings && (
            <DropdownMenuItem onClick={onOpenRelaySettings}>
              <Wifi className="h-4 w-4 mr-2" />
              Relay Settings
            </DropdownMenuItem>
          )}

          <DropdownMenuSeparator />

          {/* === SUPPORT & ABOUT === */}
          <DropdownMenuLabel className="text-xs text-muted-foreground uppercase tracking-wider">Support & About</DropdownMenuLabel>
          {onOpenWelcomeTour && (
            <DropdownMenuItem onClick={onOpenWelcomeTour}>
              <BookOpen className="h-4 w-4 mr-2" />
              Welcome Tour
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onClick={() => onSupportSatSorter?.()}>
            <Heart className="h-4 w-4 mr-2 text-primary" />
            Support Sat Sorter
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onAbout?.()}>
            <Info className="h-4 w-4 mr-2" />
            About Sat Sorter
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onLearnAboutBitcoin?.()}>
            <GraduationCap className="h-4 w-4 mr-2" />
            Learn About Bitcoin
          </DropdownMenuItem>

          {/* === LOGOUT === */}
          {currentUser && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => setShowLogoutConfirm(true)}
                className='text-destructive focus:text-destructive'
              >
                <LogOut className="h-4 w-4 mr-2" />
                Log out
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Logout confirmation */}
      <Dialog open={showLogoutConfirm} onOpenChange={setShowLogoutConfirm}>
        <DialogContent className="sm:max-w-[360px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Log out?
            </DialogTitle>
            <DialogDescription>
              You'll need to sign back in with your Nostr key to access your budget. Your data stays safely on relays — nothing is lost.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setShowLogoutConfirm(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              className="flex-1"
              onClick={() => {
                removeLogin(currentUser!.id);
                setShowLogoutConfirm(false);
              }}
            >
              <LogOut className="h-4 w-4 mr-1" />
              Yes, log out
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
