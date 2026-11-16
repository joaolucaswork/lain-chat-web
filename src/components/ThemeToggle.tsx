import { Moon, Sun } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useTheme } from '@/hooks/useTheme'

export function ThemeToggle() {
  const { dark, toggle } = useTheme()

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={toggle}
          aria-label={dark ? 'Modo claro' : 'Modo escuro'}
        >
          {dark ? <Sun /> : <Moon />}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{dark ? 'Modo claro' : 'Modo escuro'}</TooltipContent>
    </Tooltip>
  )
}
